const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 8080;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web-ui')));

// API Routes
app.get('/api/test', (req, res) => {
  res.json({ 
    message: 'LinkedIn Job Assistant is working!',
    profile: 'Yaniv Lugassy - Senior Software Developer',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/jobs', (req, res) => {
  res.json({
    success: true,
    data: [
      {
        id: '1',
        title: 'Senior Software Developer - AWS Cloud',
        company: 'Tech Company',
        location: 'Remote, USA',
        description: 'Looking for senior developer with AWS and cloud experience...',
        url: 'https://linkedin.com/jobs/view/123',
        postedDate: '2 days ago'
      },
      {
        id: '2', 
        title: 'Technical Lead - C++ Python',
        company: 'Enterprise Corp',
        location: 'San Francisco, CA',
        description: 'Senior technical lead position for C++ and Python development...',
        url: 'https://linkedin.com/jobs/view/456',
        postedDate: '1 week ago'
      }
    ],
    total: 2
  });
});

// Serve main page
app.get('/', (req, res) => {
  const indexPath = path.join(__dirname, 'web-ui', 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.send(`
      <html>
        <head><title>LinkedIn Job Assistant</title></head>
        <body style="font-family: Arial, sans-serif; margin: 40px;">
          <h1>🚀 LinkedIn Job Assistant</h1>
          <h2>Welcome, Yaniv Lugassy!</h2>
          <p>Your profile is configured and ready for job searching.</p>
          <h3>📋 Your Profile Summary:</h3>
          <ul>
            <li><strong>Role:</strong> Senior Software Developer & Technical Lead</li>
            <li><strong>Experience:</strong> 12+ years</li>
            <li><strong>Skills:</strong> C++, Python, C#, AWS, Cloud Computing</li>
            <li><strong>Location:</strong> Israel (Open to USA relocation)</li>
            <li><strong>Current:</strong> KLA - Frontline Division</li>
          </ul>
          <h3>🎯 Job Search Configuration:</h3>
          <p><strong>Keywords:</strong> "Senior Software Developer AWS Cloud"</p>
          <p><strong>Location:</strong> United States</p>
          <p><strong>Job Type:</strong> Full-time</p>
          <button onclick="startMonitoring()" style="background: #0077b5; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer;">Start Job Monitoring</button>
          <div id="results" style="margin-top: 20px;"></div>
          <script>
            async function startMonitoring() {
              document.getElementById('results').innerHTML = '<p>🔍 Searching for jobs...</p>';
              const response = await fetch('/api/jobs');
              const data = await response.json();
              displayJobs(data.data);
            }
            function displayJobs(jobs) {
              let html = '<h3>🎉 Found ' + jobs.length + ' Jobs:</h3>';
              jobs.forEach(job => {
                html += '<div style="border: 1px solid #ddd; padding: 15px; margin: 10px 0; border-radius: 8px;">';
                html += '<h4>' + job.title + '</h4>';
                html += '<p><strong>' + job.company + '</strong> - ' + job.location + '</p>';
                html += '<p>' + job.description + '</p>';
                html += '<button onclick="window.open(\'' + job.url + '\')" style="background: #28a745; color: white; padding: 8px 16px; border: none; border-radius: 4px; cursor: pointer;">Apply on LinkedIn</button>';
                html += '</div>';
              });
              document.getElementById('results').innerHTML = html;
            }
          </script>
        </body>
      </html>
    `);
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 LinkedIn Job Assistant running on http://localhost:${PORT}`);
  console.log(`📋 Profile: Yaniv Lugassy - Senior Software Developer`);
  console.log(`🎯 Ready to search for jobs in USA!`);
});
