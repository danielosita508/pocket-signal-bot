const https = require('https');
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const token = process.argv[2];
const spaceName = process.argv[3] || 'pocket-signal-bot';

if (!token || !token.startsWith('hf_')) {
  console.error("Usage: node deploy_hf.js <hf_token> [space_name]");
  process.exit(1);
}

function apiRequest(method, endpoint, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request({
      hostname: 'huggingface.co',
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    }, (res) => {
      let resData = '';
      res.on('data', chunk => resData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(resData);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          resolve({ status: res.statusCode, data: resData });
        }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  try {
    console.log("[1/4] Verifying Hugging Face Token...");
    const whoami = await apiRequest('GET', '/api/whoami-v2');
    if (whoami.status !== 200 || !whoami.data.name) {
      throw new Error(`Invalid token or unauthorized: ${JSON.stringify(whoami.data)}`);
    }

    const username = whoami.data.name;
    const repoId = `${username}/${spaceName}`;
    console.log(`✅ Authenticated as HF User: ${username}`);

    console.log(`[2/4] Creating Private Docker Space: ${repoId}...`);
    const createRes = await apiRequest('POST', '/api/repos/create', {
      type: 'space',
      name: spaceName,
      sdk: 'docker',
      private: true
    });

    if (createRes.status === 200 || createRes.status === 201) {
      console.log(`✅ Space ${repoId} created successfully!`);
    } else if (createRes.status === 409) {
      console.log(`ℹ️ Space ${repoId} already exists. Will update it.`);
    } else {
      console.warn(`Warning: ${JSON.stringify(createRes.data)}`);
    }

    console.log("[3/4] Uploading Environment Secrets to Cloud Space...");
    const secrets = [
      { key: 'TELEGRAM_API_ID', value: process.env.TELEGRAM_API_ID },
      { key: 'TELEGRAM_API_HASH', value: process.env.TELEGRAM_API_HASH },
      { key: 'TELEGRAM_SESSION', value: process.env.TELEGRAM_SESSION },
      { key: 'TARGET_CHANNEL_ID', value: process.env.TARGET_CHANNEL_ID },
      { key: 'POCKET_UID', value: process.env.POCKET_UID },
      { key: 'POCKET_SESSION_TOKEN', value: process.env.POCKET_SESSION_TOKEN },
      { key: 'IS_DEMO', value: 'true' },
      { key: 'TRADE_AMOUNT', value: '10' },
      { key: 'MIN_BALANCE_FLOOR', value: '30' }
    ];

    for (const s of secrets) {
      if (!s.value) continue;
      const secRes = await apiRequest('POST', `/api/spaces/${repoId}/secrets`, {
        key: s.key,
        value: s.value
      });
      console.log(`  • Secret ${s.key}: ${secRes.status === 200 || secRes.status === 201 ? 'Saved ✅' : 'Updated'}`);
    }

    console.log("[4/4] Pushing Code via Git...");
    const gitUrl = `https://${username}:${token}@huggingface.co/spaces/${repoId}`;
    const botDir = 'C:\\Users\\HP RYZEN\\.gemini\\antigravity\\scratch\\pocket-bot';

    // Git setup
    execSync(`git init`, { cwd: botDir });
    execSync(`git config user.name "${username}"`, { cwd: botDir });
    execSync(`git config user.email "${username}@users.noreply.huggingface.co"`, { cwd: botDir });
    
    // Create .gitignore to prevent uploading local .env
    fs.writeFileSync(path.join(botDir, '.gitignore'), ".env\nnode_modules\nauth_state.json\n");

    execSync(`git add .`, { cwd: botDir });
    try {
      execSync(`git commit -m "Deploy automated trading bot"`, { cwd: botDir });
    } catch (e) {
      // nothing to commit if already committed
    }

    console.log("Pushing to Hugging Face Space repository...");
    execSync(`git push --force "${gitUrl}" master:main`, { cwd: botDir });

    console.log("\n=======================================================");
    console.log(`🚀 DEPLOYMENT COMPLETED!`);
    console.log(`Your bot is now building and running 24/7 at:`);
    console.log(`https://huggingface.co/spaces/${repoId}`);
    console.log(`=======================================================\n`);

  } catch (err) {
    console.error("❌ Deployment failed:", err.message);
    process.exit(1);
  }
})();
