#!/usr/bin/env node

import { execSync } from 'child_process';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { createInterface } from 'readline';

const rl = createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

function run(command, description = '') {
  try {
    console.log(`\n▶ ${description || command}`);
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });
    return true;
  } catch (error) {
    console.error(`\n✗ Failed: ${description || command}`);
    return false;
  }
}

async function main() {
  console.log('\n╔════════════════════════════════════════╗');
  console.log('║     🚀 Cyb3rWrld Checkers Release     ║');
  console.log('╚════════════════════════════════════════╝\n');

  try {
    // Read version from package.json
    const packageJson = JSON.parse(readFileSync(resolve('package.json'), 'utf-8'));
    const version = packageJson.version;

    console.log(`📦 Current version: v${version}\n`);

    // Get commit message
    let commitMessage = process.argv[2];
    if (!commitMessage) {
      const suggestions = [
        'Update checker piece colors',
        'Fix game logic bug',
        'Improve performance',
        'Add new feature',
        'Update documentation',
        'Refactor code',
        'Fix memory leak',
        'Optimize rendering'
      ];

      console.log('Suggested messages:');
      suggestions.forEach((s, i) => {
        console.log(`  ${i + 1}. ${s}`);
      });

      const input = await question(
        '\nEnter commit message (number to select, or custom text): '
      );
      const num = parseInt(input);
      commitMessage =
        num > 0 && num <= suggestions.length ? suggestions[num - 1] : input.trim();
    }

    if (!commitMessage) {
      console.error('✗ Commit message cannot be empty');
      process.exit(1);
    }

    console.log(`\n📝 Commit message: ${commitMessage}`);
    const confirm = await question('Proceed? (y/n): ');
    if (confirm.toLowerCase() !== 'y') {
      console.log('Cancelled.');
      process.exit(0);
    }

    // Step 1: Check tools
    console.log('\n🔍 Checking tools...');
    try {
      execSync('where gh >nul 2>nul || exit 1', { stdio: 'pipe', shell: true });
      execSync('where git >nul 2>nul || exit 1', { stdio: 'pipe', shell: true });
      execSync('where npm >nul 2>nul || exit 1', { stdio: 'pipe', shell: true });
    } catch {
      console.error('✗ Required tools not found: git, npm, gh (GitHub CLI)');
      console.error('Install gh: https://github.com/cli/cli');
      process.exit(1);
    }
    console.log('✓ All tools found\n');

    // Step 2: Git commit and push
    if (!run('git add -A', 'Step 1: Adding changes')) process.exit(1);

    const status = execSync('git status --porcelain', { encoding: 'utf-8' }).trim();
    if (status) {
      if (!run(`git commit -m "${commitMessage}"`, 'Step 2: Committing changes'))
        process.exit(1);
    } else {
      console.log('\n▶ Step 2: Committing changes');
      console.log('  (nothing to commit, skipping)');
    }

    if (!run('git push', 'Step 3: Pushing to GitHub')) process.exit(1);

    // Step 3: Build
    if (!run('npm run dist', 'Step 4: Building app')) process.exit(1);

    // Step 4: Find and create release
    console.log('\n▶ Step 5: Creating GitHub release');
    try {
      const files = execSync('powershell -Command "Get-ChildItem release\\*.exe"', {
        encoding: 'utf-8'
      }).split('\n');
      const exeFile = files
        .find((f) => f.includes('.exe'))
        .split('\\')
        .pop()
        .trim();

      if (!exeFile) {
        console.error('✗ Could not find .exe file');
        process.exit(1);
      }

      const releasePath = `release\\${exeFile}`;
      const releaseNotes = `Release v${version}: ${commitMessage}`;

      execSync(
        `gh release create v${version} "${releasePath}" --title "v${version}" --notes "${releaseNotes}"`,
        { stdio: 'inherit' }
      );
      console.log(`✓ Release created: v${version}`);
    } catch (error) {
      console.error('✗ Release creation failed');
      console.error('Make sure you authenticated with: gh auth login');
      process.exit(1);
    }

    console.log('\n╔════════════════════════════════════════╗');
    console.log('║  ✓ Release completed successfully!   ║');
    console.log('╚════════════════════════════════════════╝\n');
    console.log(`Version: v${version}`);
    console.log(`Commit: ${commitMessage}`);
    console.log(`Executable: ${exeFile || 'See above'}`);
    console.log('\nUpdate will be available to clients on next check.\n');
  } catch (error) {
    console.error('Fatal error:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

main();
