const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const jwt = require('jsonwebtoken');
const router = express.Router();

// Multer setup for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// JWT Secret - In production, use environment variable
const JWT_SECRET = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHFjZmRieXNjcWdyZHJxZWd1Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAzNDM1MiwiZXhwIjoyMDY3NjEwMzUyfQ.bEFQLDvIeX0rfM_zfrMM1mTVFMFc8_wuSy28R1g3qBg";

// Verify token middleware
const verifyToken = (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Access token required' 
    });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ 
      success: false, 
      message: 'Invalid or expired token' 
    });
  }
};


// Supabase config
const supabaseUrl = process.env.SUPABASE_URL || "https://nrxqcfdbyscqgrdrqegu.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHFjZmRieXNjcWdyZHJxZWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMzQzNTIsImV4cCI6MjA2NzYxMDM1Mn0.TR9RdSYoaKwryNAJRlD6rhas4ri3liqT4p2-yvE6Vtg";
const supabase = createClient(supabaseUrl, supabaseKey);

// Cloudinary config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcgmeefn2",
  api_key: process.env.CLOUDINARY_API_KEY || "129717485266288",
  api_secret: process.env.CLOUDINARY_API_SECRET || "UJn3iq9LpYAxf_MRLwB1kA0ioTU",
});



// Face detection API config
const FACE_DETECTION_URL = 'http://localhost:8000/detect-from-url/';

// Helper function to handle face detection
async function performFaceDetection(imageUrl) {
  try {
    console.log('Sending image URL to face detection API:', imageUrl);
    const response = await axios.post(FACE_DETECTION_URL, {
      url: imageUrl
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    });
    
    const result = response.data;
    console.log('Face detection API response:', result);
    return result;
  } catch (error) {
    console.error('Face detection error:', error.response?.data || error.message);
    return null;
  }
}

// POST /api/report_missing
router.post('/report_missing', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const {
      full_name,
      age_when_missing,
      gender,
      last_seen_location,
      last_seen_date,
      guardian_name,
      relationship,
      phone_number,
      email
    } = req.body;
    
        // Get user_id from authenticated user's JWT token
    const user_id = req.user.id;
    console.log('✅ Authenticated user creating missing person report:', { user_id, email: req.user.email, role: req.user.role });
    
    // Validate required fields
    if (!full_name || !guardian_name) {
      return res.status(400).json({ success: false, message: 'Full name and guardian name are required.' });
    }

    // Handle image upload to Cloudinary
    let image_url = null;
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream({ resource_type: 'image', folder: 'missing_reports' }, (err, result) => {
            if (err) {
              console.error('Cloudinary upload error:', err);
              reject(err);
            } else {
              resolve(result);
            }
          }).end(req.file.buffer);
        });
        console.log('Cloudinary upload result:', uploadResult);
        image_url = uploadResult.secure_url;
        if (!image_url) {
          console.error('No secure_url returned from Cloudinary!');
          return res.status(500).json({ success: false, message: 'Image upload failed. No URL returned.' });
        }
        console.log('Image URL to be saved:', image_url);
      } catch (uploadErr) {
        console.error('Image upload failed:', uploadErr);
        return res.status(500).json({ success: false, message: 'Image upload failed.', error: uploadErr });
      }
    }

    // Create base report data
    const baseReportData = {
      full_name,
      age_when_missing: age_when_missing ? parseInt(age_when_missing) : null,
      gender,
      last_seen_location,
      last_seen_date: last_seen_date || null,
      image_url,
      guardian_name,
      relationship,
      phone_number,
      email,
      user_id: user_id || null, // ID of user who created the report (from users_table)
      matched_report: null, // Will store user_id from face detection API response when match found
      status: 'active' // <-- Always set status to 'active' on creation
    };

    // Add face detection results if image is available
    let finalReportData = { ...baseReportData };
    if (image_url) {
      const faceDetectionResult = await performFaceDetection(image_url);
      if (faceDetectionResult) {
        finalReportData = {
          ...finalReportData,
          face_detection_result: faceDetectionResult,
          matched_with: faceDetectionResult.verified ? faceDetectionResult.matched_with : null
        };
        
        // If face detection verified a match, update the report data
        if (faceDetectionResult.verified === true && faceDetectionResult.matched_with) {
          console.log('✅ Face detection verified match found during missing person report submission');
          
          // Extract the user_id from matched_with object
          let matchedUserId = null;
          if (typeof faceDetectionResult.matched_with === 'object' && faceDetectionResult.matched_with.user_id) {
            matchedUserId = faceDetectionResult.matched_with.user_id;
            console.log('Matched with user_id from unknown_persons:', matchedUserId);
          }
          
          if (matchedUserId) {
            // Update matched_report with the user_id from face detection API response
            finalReportData = {
              ...finalReportData,
              matched_report: parseInt(matchedUserId), // Store the user_id from unknown_persons table
              status: 'found' // Mark as found immediately
            };
            console.log('Updated report data with matched_report:', matchedUserId, 'and status: found');
            console.log('Original user_id (reporter) preserved:', finalReportData.user_id);
          }
        }
      }
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('missing_reports')
      .insert([finalReportData])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ success: false, message: 'Database error', error });
    }

    res.status(201).json({ 
      success: true, 
      message: 'Missing report submitted', 
      report: data,
      faceDetectionPerformed: finalReportData.face_detection_result !== undefined
    });

  } catch (err) {
    console.error('Report missing error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// GET /api/user_missing_reports
router.get('/user_missing_reports', verifyToken, async (req, res) => {
  // Get user_id from authenticated user's JWT token
  const user_id = req.user.id;
  console.log('✅ Authenticated user fetching their missing person reports:', { user_id, email: req.user.email, role: req.user.role });
  
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select(`
        *,
        users_table!missing_reports_user_id_fkey (
          user_id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', user_id) // Query by reporter's user_id
      .order('created_at', { ascending: false });

    if (error) {
      return res.status(500).json({ success: false, message: 'Database error', error });
    }

    res.json({ success: true, data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// Add this endpoint to get all missing reports
router.get('/missing-reports', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select(`
        *,
        users_table!missing_reports_user_id_fkey (
          user_id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', req.user.id) // Only show reports created by this user
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching missing reports:', error);
    res.status(500).json({ error: 'Failed to fetch missing reports' });
  }
});

// GET endpoint to fetch both missing and unknown person reports
router.get('/all-reports', verifyToken, async (req, res) => {
  try {
    console.log('✅ Authenticated user fetching all reports:', { user_id: req.user.id, email: req.user.email, role: req.user.role });
    
    // Fetch missing reports with user information (ONLY for authenticated user)
    const { data: missingReports, error: missingError } = await supabase
      .from('missing_reports')
      .select(`
        *,
        users_table!missing_reports_user_id_fkey (
          user_id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', req.user.id) // Only show reports created by this user
      .order('created_at', { ascending: false });

    if (missingError) throw missingError;

    // Fetch unknown person reports
    const { data: unknownReports, error: unknownError } = await supabase
      .from('unknown_persons')
      .select('*')
      .order('date_time', { ascending: false });

    if (unknownError) throw unknownError;

    // Organize reports into categories
    const organizedReports = {
      missingRelatives: {
        active: missingReports.filter(report => report.status === 'active'),
        found: missingReports.filter(report => report.status === 'found')
      },
      unknownPersons: {
        reports: unknownReports
      }
    };

    // Calculate counts
    const counts = {
      missingRelatives: {
        active: organizedReports.missingRelatives.active.length,
        found: organizedReports.missingRelatives.found.length,
        total: missingReports.length
      },
      unknownPersons: {
        total: unknownReports.length
      }
    };

    res.json({
      success: true,
      data: organizedReports,
      counts: counts
    });

  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to fetch reports' 
    });
  }
});

// POST endpoint for reporting unknown person
router.post('/report-unknown', verifyToken, upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      location
    } = req.body;
    
        // Get user_id from authenticated user's JWT token
    const user_id = req.user.id;
    console.log('✅ Authenticated user reporting unknown person:', { user_id, email: req.user.email, role: req.user.role });
    
    // Handle image upload to Cloudinary
    let image_url = null;
    if (req.file) {
      try {
        const uploadResult = await new Promise((resolve, reject) => {
          cloudinary.uploader.upload_stream(
            { resource_type: 'image', folder: 'unknown_persons' },
            (err, result) => {
              if (err) reject(err);
              else resolve(result);
            }
          ).end(req.file.buffer);
        });
        
        image_url = uploadResult.secure_url;
      } catch (uploadErr) {
        console.error('Image upload failed:', uploadErr);
        return res.status(500).json({ 
          success: false, 
          message: 'Image upload failed.' 
        });
      }
    }

    // Create unknown person report
    const { data, error } = await supabase
      .from('unknown_persons')
      .insert([{
        user_id: user_id || null,
        name: name || null,
        image_url,
        location,
        date_time: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to save unknown person report' 
      });
    }

    // If image exists, perform face detection
    if (image_url) {
      console.log('🔄 Starting face detection process for image:', image_url);
      const faceDetectionResult = await performFaceDetection(image_url);
      console.log('Face detection result for unknown person:', faceDetectionResult);
      
             // Check if face detection verified a match
       if (faceDetectionResult?.verified === true && faceDetectionResult?.matched_with) {
         console.log('✅ Face detection verified match found, updating missing person status to found');
         console.log('Full face detection result:', JSON.stringify(faceDetectionResult, null, 2));
         
         // Extract the user_id from matched_with object (this comes from unknown_persons table)
         let matchedUserId = null;
         if (typeof faceDetectionResult.matched_with === 'object' && faceDetectionResult.matched_with.user_id) {
           matchedUserId = faceDetectionResult.matched_with.user_id;
           console.log('Matched with user_id from unknown_persons:', matchedUserId);
         }
         
                   if (matchedUserId) {
            try {
              console.log('Starting update process for user_id:', matchedUserId);
              console.log('Note: This will update matched_report column, preserving the original user_id (reporter)');
             
             // Ensure user_id is an integer
             const userIdToUpdate = parseInt(matchedUserId);
             console.log('Converted user_id to integer:', userIdToUpdate);
             
                           // Update payload to mark missing persons as found and link to this unknown person
              const updatePayload = { 
                status: 'found',
                matched_report: userIdToUpdate, // Update matched_report to link to unknown_persons table
                updated_at: new Date().toISOString()
              };
             
             console.log('Update payload:', updatePayload);

             // Find and update all active missing person reports that might match this unknown person
             const { data: updateData, error: updateError } = await supabase
               .from('missing_reports')
               .update(updatePayload)
               .eq('status', 'active')      // only update if still active
               .select();

             if (updateError) {
               console.error('Error updating missing reports:', updateError);
             } else {
               console.log(`✅ Successfully updated ${updateData.length} missing person reports to found`);
               console.log('Updated matched_report to:', userIdToUpdate);
             }
           } catch (updateErr) {
             console.error('Error updating missing report status:', updateErr);
             console.error('Full error:', updateErr);
           }
         } else {
           console.log('Could not determine user_id from face detection result');
           console.log('Face detection result structure:', JSON.stringify(faceDetectionResult, null, 2));
         }
      } else if (faceDetectionResult?.verified === true) {
        console.log('Face detection verified but no match details:', faceDetectionResult);
      } else if (faceDetectionResult?.matched_with) {
        // If there's a match but not verified, log it for review
        console.log('Potential match found but not verified:', faceDetectionResult);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Unknown person report submitted successfully',
      data: data
    });

  } catch (err) {
    console.error('Error reporting unknown person:', err);
    res.status(500).json({ 
      success: false, 
      message: 'Internal server error' 
    });
  }
});

// Update status of missing person report
router.put('/missing-report/:id/status', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'found'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Must be either "active" or "found"'
      });
    }

    const updateData = { 
      status,
      updated_at: new Date().toISOString()
    };

    // If marking as found, add found_date
    if (status === 'found') {
      updateData.found_date = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('missing_reports')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: `Report status updated to ${status}`,
      data: data
    });

  } catch (error) {
    console.error('Error updating report status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update report status'
    });
  }
});

// New endpoint to mark a missing person as found
router.post('/mark-person-found/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Validate the missing report exists
    const { data: existingReport, error: fetchError } = await supabase
      .from('missing_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing person report not found'
      });
    }

    if (existingReport.status === 'found') {
      return res.status(400).json({
        success: false,
        message: 'This person has already been marked as found'
      });
    }

    // Update the missing report status to found (only status column)
    const { data, error } = await supabase
      .from('missing_reports')
      .update({ 
        status: 'found',
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      message: 'Person marked as found successfully',
      data: data
    });

  } catch (error) {
    console.error('Error marking person as found:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to mark person as found'
    });
  }
});

// Debug endpoint to check missing reports table
router.get('/debug-missing-reports', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select(`
        *,
        users_table!missing_reports_user_id_fkey (
          user_id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', req.user.id); // Only show reports created by this user

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      reports: data,
      message: 'Debug info for missing_reports table'
    });

  } catch (error) {
    console.error('Error fetching debug info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch debug info',
      error: error.message
    });
  }
});

// Debug endpoint to check unknown persons table
router.get('/debug-unknown-persons', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('unknown_persons')
      .select('*');

    if (error) throw error;

    res.json({
      success: true,
      count: data.length,
      reports: data,
      message: 'Debug info for unknown_persons table'
    });

  } catch (error) {
    console.error('Error fetching debug info:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch debug info',
      error: error.message
    });
  }
});

// New endpoint to get found persons with details
router.get('/found-persons', verifyToken, async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select(`
        *,
        users_table!missing_reports_user_id_fkey (
          user_id,
          name,
          email,
          phone,
          address
        )
      `)
      .eq('user_id', req.user.id) // Only show reports created by this user
      .eq('status', 'found')
      .order('found_date', { ascending: false });

    if (error) throw error;

    res.json({
      success: true,
      data: data
    });

  } catch (error) {
    console.error('Error fetching found persons:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch found persons'
    });
  }
});

// New endpoint to manually trigger face detection and update status
router.post('/trigger-face-detection/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the missing person report
    const { data: missingReport, error: fetchError } = await supabase
      .from('missing_reports')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !missingReport) {
      return res.status(404).json({
        success: false,
        message: 'Missing person report not found'
      });
    }

    if (!missingReport.image_url) {
      return res.status(400).json({
        success: false,
        message: 'No image available for face detection'
      });
    }

    if (missingReport.status === 'found') {
      return res.status(400).json({
        success: false,
        message: 'This person has already been marked as found'
      });
    }

    // Perform face detection
    console.log('Triggering face detection for missing person:', missingReport.full_name);
    const faceDetectionResult = await performFaceDetection(missingReport.image_url);
    
    if (faceDetectionResult?.verified === true && faceDetectionResult?.matched_with) {
      console.log('Face detection verified match found, updating status to found');
      
      // Extract the user_id from matched_with object
      let matchedUserId = null;
      if (typeof faceDetectionResult.matched_with === 'object' && faceDetectionResult.matched_with.user_id) {
        matchedUserId = faceDetectionResult.matched_with.user_id;
        console.log('Matched with user_id:', matchedUserId);
      }
      
      if (matchedUserId) {
        // Update the missing person report status to found and link to unknown person
        try {
          console.log('Trigger face detection - Starting update for user_id:', matchedUserId);
          console.log('user_id type:', typeof matchedUserId);
          
          // Ensure user_id is an integer
          const userIdToUpdate = parseInt(matchedUserId);
          console.log('Converted user_id to integer:', userIdToUpdate);
          
          const updatePayload = { 
            status: 'found',
            matched_report: userIdToUpdate, // Update matched_report to link to unknown_persons table
            updated_at: new Date().toISOString()
          };
          
          console.log('Update payload:', updatePayload);

          const { data: updateData, error: updateError } = await supabase
            .from('missing_reports')
            .update(updatePayload)
            .eq('id', id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating missing report status:', updateError);
            return res.status(500).json({
              success: false,
              message: 'Failed to update report status'
            });
          }

          console.log('Successfully updated missing report status to found:', updateData);
          console.log('Updated matched_report:', updateData.matched_report);
          console.log('Updated status:', updateData.status);

          res.json({
            success: true,
            message: 'Person marked as found via face detection',
            data: updateData,
            faceDetectionResult: faceDetectionResult
          });
        } catch (updateErr) {
          console.error('Error in update process:', updateErr);
          return res.status(500).json({
            success: false,
            message: 'Failed to update report status'
          });
        }
      } else {
        res.json({
          success: false,
          message: 'Face detection verified but no valid user_id found',
          faceDetectionResult: faceDetectionResult
        });
      }
    } else {
      res.json({
        success: false,
        message: 'No verified match found via face detection',
        faceDetectionResult: faceDetectionResult
      });
    }

  } catch (error) {
    console.error('Error triggering face detection:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger face detection'
    });
  }
});

module.exports = router;
