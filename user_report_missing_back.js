const express = require('express');
const multer = require('multer');
const { createClient } = require('@supabase/supabase-js');
const cloudinary = require('cloudinary').v2;
const router = express.Router();

// Multer setup for file upload (memory storage)
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Supabase config (reuse from login_signup.js or use env)
const supabaseUrl = process.env.SUPABASE_URL || "https://nrxqcfdbyscqgrdrqegu.supabase.co";
const supabaseKey = process.env.SUPABASE_ANON_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5yeHFjZmRieXNjcWdyZHJxZWd1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMzQzNTIsImV4cCI6MjA2NzYxMDM1Mn0.TR9RdSYoaKwryNAJRlD6rhas4ri3liqT4p2-yvE6Vtg";
const supabase = createClient(supabaseUrl, supabaseKey);

// Cloudinary config (set these in your .env)
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "dcgmeefn2",
  api_key: process.env.CLOUDINARY_API_KEY || "129717485266288",
  api_secret: process.env.CLOUDINARY_API_SECRET || "UJn3iq9LpYAxf_MRLwB1kA0ioTU",
});

// POST /api/report_missing
router.post('/report_missing', upload.single('image'), async (req, res) => {
  try {
    // Required fields from form-data
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
      user_id // optional
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
    // Insert into Supabase
    console.log('Final image_url to insert:', image_url);
    const { data, error } = await supabase
      .from('missing_reports')
      .insert([
        {
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
          user_id: user_id || null
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(500).json({ success: false, message: 'Database error', error });
    }

    res.status(201).json({ success: true, message: 'Missing report submitted', report: data });
  } catch (err) {
    console.error('Report missing error:', err);
    res.status(500).json({ success: false, message: 'Internal server error', error: err.message });
  }
});

// GET /api/user_missing_reports?user_id=123
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

module.exports = router;
