const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const router = express.Router();

// Multer setup for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });


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
router.post('/report_missing', upload.single('image'), async (req, res) => {
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
      email,
      user_id
    } = req.body;

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
      user_id: user_id || null,
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
            // Update the report data to mark as found and link to unknown person
            const userIdToUpdate = parseInt(matchedUserId);
            finalReportData = {
              ...finalReportData,
              status: 'found',  // Mark as found immediately
              user_id: userIdToUpdate,  // Link to unknown_persons table
              matched_with: JSON.stringify(faceDetectionResult.matched_with)  // Store matched_with data
            };
            console.log('Updated report data with user_id:', userIdToUpdate, 'and status: found');
            
            // Also update any existing active missing person reports
            try {
              const updatePayload = { 
                status: 'found',
                user_id: userIdToUpdate,
                matched_with: JSON.stringify(faceDetectionResult.matched_with),
                updated_at: new Date().toISOString()
              };
              
              const { data: updateData, error: updateError } = await supabase
                .from('missing_reports')
                .update(updatePayload)
                .eq('status', 'active')
                .select();

              if (updateError) {
                console.error('Error updating existing active reports:', updateError);
              } else {
                console.log(`Updated ${updateData.length} existing active reports to found with user_id:`, userIdToUpdate);
              }
            } catch (updateErr) {
              console.error('Error updating existing reports:', updateErr);
            }
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
router.get('/user_missing_reports', async (req, res) => {
  const { user_id } = req.query;
  if (!user_id) {
    return res.status(400).json({ success: false, message: 'user_id is required' });
  }
  
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select('*')
      .eq('user_id', user_id)
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
router.get('/missing-reports', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    res.json(data);
  } catch (error) {
    console.error('Error fetching missing reports:', error);
    res.status(500).json({ error: 'Failed to fetch missing reports' });
  }
});

// GET endpoint to fetch both missing and unknown person reports
router.get('/all-reports', async (req, res) => {
  try {
    // Fetch missing reports
    const { data: missingReports, error: missingError } = await supabase
      .from('missing_reports')
      .select('*')
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
router.post('/report-unknown', upload.single('image'), async (req, res) => {
  try {
    const {
      name,
      location,
      user_id
    } = req.body;

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
             
             // Ensure user_id is an integer
             const userIdToUpdate = parseInt(matchedUserId);
             console.log('Converted user_id to integer:', userIdToUpdate);
             
             // Simply update all active missing person reports with the user_id from API response
             const updatePayload = { 
               status: 'found',
               user_id: userIdToUpdate,  // Update user_id to link to unknown_persons table
               matched_with: JSON.stringify(faceDetectionResult.matched_with),   // Store the matched_with data as JSON string
               updated_at: new Date().toISOString()
             };
             
             console.log('Update payload:', updatePayload);

             // Update all active missing person reports
             const { data: updateData, error: updateError } = await supabase
               .from('missing_reports')
               .update(updatePayload)
               .eq('status', 'active')
               .select();

             if (updateError) {
               console.error('Error updating missing reports:', updateError);
               console.error('Update error details:', updateError);
             } else {
               console.log(`Successfully updated ${updateData.length} missing person reports to found`);
               console.log('Updated user_id:', userIdToUpdate);
               console.log('✅ All active missing person reports updated successfully!');
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
router.put('/missing-report/:id/status', async (req, res) => {
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
router.post('/mark-person-found/:id', async (req, res) => {
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
router.get('/debug-missing-reports', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select('*');

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
router.get('/debug-unknown-persons', async (req, res) => {
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
router.get('/found-persons', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('missing_reports')
      .select('*')
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
router.post('/trigger-face-detection/:id', async (req, res) => {
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
            user_id: userIdToUpdate,  // Update user_id to link to unknown_persons table
            matched_with: JSON.stringify(faceDetectionResult.matched_with),  // Store the matched_with data as JSON string
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
            console.error('Update error details:', updateError);
            console.error('Error code:', updateError.code);
            console.error('Error message:', updateError.message);
            return res.status(500).json({
              success: false,
              message: 'Failed to update report status'
            });
          }

          console.log('Successfully updated missing report status to found:', updateData);
          console.log('Updated user_id:', updateData.user_id);
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
