const { execSync, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJECT_ROOT = __dirname;
const BACKEND_DIR = path.join(PROJECT_ROOT, 'backend');
const FRONTEND_DIR = path.join(PROJECT_ROOT, 'frontend');

const results = {};

function logStep(step, message) {
  console.log(`\n========== ${step} ==========`);
  console.log(message);
}

function runCommand(cmd, cwd) {
  try {
    console.log(`执行命令: ${cmd}`);
    console.log(`工作目录: ${cwd}`);
    const output = execSync(cmd, {
      cwd: cwd,
      encoding: 'utf8',
      stdio: 'pipe',
      timeout: 10 * 60 * 1000,
      maxBuffer: 10 * 1024 * 1024,
    });
    console.log('命令成功执行');
    if (output.trim()) {
      console.log('输出 (前2000字符):');
      console.log(output.substring(0, 2000));
    }
    return { success: true, output };
  } catch (error) {
    console.log(`命令执行失败: ${error.message}`);
    if (error.stdout) {
      console.log('stdout:', error.stdout.substring(0, 1000));
    }
    if (error.stderr) {
      console.log('stderr:', error.stderr.substring(0, 1000));
    }
    return { success: false, error: error.message, stdout: error.stdout, stderr: error.stderr };
  }
}

function checkNodeNpm() {
  logStep('检查环境', '检查 node 和 npm 是否可用');
  try {
    const nodeVersion = execSync('node --version', { encoding: 'utf8' }).trim();
    console.log(`Node.js 版本: ${nodeVersion}`);
    results.nodeVersion = nodeVersion;
  } catch (e) {
    console.log('ERROR: node 命令找不到!');
    results.nodeNotFound = true;
    return false;
  }

  try {
    const npmVersion = execSync('npm --version', { encoding: 'utf8' }).trim();
    console.log(`npm 版本: ${npmVersion}`);
    results.npmVersion = npmVersion;
  } catch (e) {
    console.log('ERROR: npm 命令找不到!');
    results.npmNotFound = true;
    return false;
  }
  return true;
}

function step1BackendNpmInstall() {
  logStep('步骤 1: 后端 npm install', '安装 backend 依赖');
  const result = runCommand('npm install', BACKEND_DIR);
  results.step1 = result;
  if (result.success) {
    console.log('后端 node_modules 检查:');
    const nodeModulesExists = fs.existsSync(path.join(BACKEND_DIR, 'node_modules'));
    console.log(`  node_modules 存在: ${nodeModulesExists}`);
  }
  return result.success;
}

function step2FrontendNpmInstall() {
  logStep('步骤 2: 前端 npm install', '安装 frontend 依赖');
  const result = runCommand('npm install', FRONTEND_DIR);
  results.step2 = result;
  if (result.success) {
    console.log('前端 node_modules 检查:');
    const nodeModulesExists = fs.existsSync(path.join(FRONTEND_DIR, 'node_modules'));
    console.log(`  node_modules 存在: ${nodeModulesExists}`);
  }
  return result.success;
}

function step3StartBackendServer() {
  logStep('步骤 3: 启动后端服务', '后台运行 node src/server.js');
  return new Promise((resolve) => {
    const serverProc = spawn('node', ['src/server.js'], {
      cwd: BACKEND_DIR,
      detached: true,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
    });

    results.serverPid = serverProc.pid;
    console.log(`服务进程已启动，PID: ${serverProc.pid}`);

    let serverOutput = '';
    serverProc.stdout.on('data', (data) => {
      const text = data.toString();
      serverOutput += text;
      process.stdout.write('[服务输出] ' + text);
    });
    serverProc.stderr.on('data', (data) => {
      const text = data.toString();
      serverOutput += text;
      process.stderr.write('[服务错误] ' + text);
    });

    results.serverOutput = serverOutput;
    serverProc.unref();

    console.log('等待服务启动 (5秒)...');
    setTimeout(() => {
      results.step3 = { success: true, pid: serverProc.pid };
      resolve(true);
    }, 5000);
  });
}

function step4QueryVersionApi() {
  logStep('步骤 4: 访问 /api/version', '调用 http://localhost:3001/api/version');
  return new Promise((resolve) => {
    const options = {
      hostname: 'localhost',
      port: 3001,
      path: '/api/version',
      method: 'GET',
      timeout: 10000,
    };

    let attempts = 0;
    const maxAttempts = 3;

    function tryRequest() {
      attempts++;
      console.log(`尝试 ${attempts}/${maxAttempts}...`);

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log(`响应状态码: ${res.statusCode}`);
          console.log(`响应内容: ${data}`);
          results.step4 = {
            success: res.statusCode === 200,
            statusCode: res.statusCode,
            response: data,
          };
          try {
            results.step4.parsedJson = JSON.parse(data);
          } catch (e) {
            results.step4.parseError = e.message;
          }
          resolve(res.statusCode === 200);
        });
      });

      req.on('error', (error) => {
        console.log(`请求失败: ${error.message}`);
        if (attempts < maxAttempts) {
          console.log('2秒后重试...');
          setTimeout(tryRequest, 2000);
        } else {
          results.step4 = { success: false, error: error.message };
          resolve(false);
        }
      });

      req.on('timeout', () => {
        req.destroy();
        console.log('请求超时');
        if (attempts < maxAttempts) {
          console.log('2秒后重试...');
          setTimeout(tryRequest, 2000);
        } else {
          results.step4 = { success: false, error: '请求超时' };
          resolve(false);
        }
      });

      req.end();
    }

    tryRequest();
  });
}

function printSummary() {
  console.log('\n\n');
  console.log('==================================================');
  console.log('                  执行结果报告');
  console.log('==================================================');

  console.log('\n【环境检查】');
  if (results.nodeNotFound) {
    console.log('  - ❌ node 命令找不到，请安装 Node.js');
  } else {
    console.log(`  - ✅ Node.js 版本: ${results.nodeVersion}`);
  }
  if (results.npmNotFound) {
    console.log('  - ❌ npm 命令找不到，请安装 Node.js');
  } else {
    console.log(`  - ✅ npm 版本: ${results.npmVersion}`);
  }

  console.log('\n【步骤 1: backend npm install】');
  if (results.step1) {
    console.log(`  - 状态: ${results.step1.success ? '✅ 成功' : '❌ 失败'}`);
  } else {
    console.log('  - 状态: ⏭️  未执行');
  }

  console.log('\n【步骤 2: frontend npm install】');
  if (results.step2) {
    console.log(`  - 状态: ${results.step2.success ? '✅ 成功' : '❌ 失败'}`);
  } else {
    console.log('  - 状态: ⏭️  未执行');
  }

  console.log('\n【步骤 3: 启动后端服务】');
  if (results.step3) {
    console.log(`  - 状态: ${results.step3.success ? '✅ 成功' : '❌ 失败'}`);
    console.log(`  - 进程 PID: ${results.step3.pid}`);
  } else {
    console.log('  - 状态: ⏭️  未执行');
  }

  console.log('\n【步骤 4: /api/version 接口返回】');
  if (results.step4) {
    console.log(`  - 状态: ${results.step4.success ? '✅ 成功' : '❌ 失败'}`);
    if (results.step4.statusCode) {
      console.log(`  - HTTP 状态码: ${results.step4.statusCode}`);
    }
    if (results.step4.error) {
      console.log(`  - 错误: ${results.step4.error}`);
    }
    if (results.step4.parsedJson) {
      console.log('  - 返回的 JSON:');
      console.log('    ' + JSON.stringify(results.step4.parsedJson, null, 2).replace(/\n/g, '\n    '));
    } else if (results.step4.response) {
      console.log(`  - 返回内容: ${results.step4.response}`);
    }
  } else {
    console.log('  - 状态: ⏭️  未执行');
  }

  const reportPath = path.join(PROJECT_ROOT, 'task-results.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf8');
  console.log(`\n完整结果已保存到: ${reportPath}`);
}

async function main() {
  console.log('开始执行任务...');
  console.log(`项目根目录: ${PROJECT_ROOT}`);

  const envOk = checkNodeNpm();
  if (!envOk) {
    console.log('\n环境检查失败，中止执行');
    printSummary();
    process.exit(1);
  }

  step1BackendNpmInstall();
  step2FrontendNpmInstall();
  await step3StartBackendServer();
  await step4QueryVersionApi();

  printSummary();
}

main().catch((e) => {
  console.error('执行过程中出现未捕获异常:', e);
  printSummary();
  process.exit(1);
});
