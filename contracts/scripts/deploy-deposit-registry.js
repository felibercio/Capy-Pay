import fs from 'fs';
import path from 'path';
import solc from 'solc';
import dotenv from 'dotenv';
import { ethers } from 'ethers';

// Load env from contracts/.env
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const PROJECT_ROOT = process.cwd();
const SRC_DIR = path.join(PROJECT_ROOT, 'src');

function findImports(importPath) {
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const ozPath = path.join(PROJECT_ROOT, 'node_modules', importPath);
      return { contents: fs.readFileSync(ozPath, 'utf8') };
    }
    const localPath = path.join(SRC_DIR, importPath);
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8') };
    }
    const rootPath = path.join(PROJECT_ROOT, importPath);
    if (fs.existsSync(rootPath)) {
      return { contents: fs.readFileSync(rootPath, 'utf8') };
    }
  } catch (err) {
    return { error: `Error reading import ${importPath}: ${err.message}` };
  }
  return { error: `Import not found: ${importPath}` };
}

function compileContract(sourceFile) {
  const sourcePath = path.join(SRC_DIR, sourceFile);
  const source = fs.readFileSync(sourcePath, 'utf8');

  const input = {
    language: 'Solidity',
    sources: {
      [sourceFile]: { content: source }
    },
    settings: {
      optimizer: { enabled: true, runs: 200 },
      outputSelection: {
        '*': {
          '*': ['abi', 'evm.bytecode.object']
        }
      }
    }
  };

  const output = JSON.parse(solc.compile(JSON.stringify(input), { import: findImports }));
  if (output.errors && output.errors.length) {
    const fatal = output.errors.filter(e => e.severity === 'error');
    fatal.forEach(e => console.error('Solc Error:', e.formattedMessage || e.message));
    if (fatal.length) throw new Error('Solidity compilation failed');
  }
  const contractsForFile = output.contracts[sourceFile];
  if (!contractsForFile) {
    throw new Error(`No contracts output for ${sourceFile}`);
  }
  const contractName = Object.keys(contractsForFile)[0];
  const artifact = contractsForFile[contractName];

  return {
    contractName,
    abi: artifact.abi,
    bytecode: artifact.evm.bytecode.object
  };
}

async function main() {
  const RPC_URL = process.env.BASE_TESTNET_RPC_URL || process.env.BASE_RPC_URL || process.env.BASE_SEPOLIA_RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const ADMIN_RAW = process.env.DEPOSIT_REGISTRY_ADMIN;
  const RECORDER_RAW = process.env.DEPOSIT_REGISTRY_RECORDER;

  if (!RPC_URL || !PRIVATE_KEY) {
    throw new Error('Missing RPC URL or PRIVATE_KEY in contracts/.env');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const admin = (ADMIN_RAW && ethers.isAddress(ADMIN_RAW)) ? ethers.getAddress(ADMIN_RAW) : wallet.address;
  const recorder = (RECORDER_RAW && ethers.isAddress(RECORDER_RAW)) ? ethers.getAddress(RECORDER_RAW) : wallet.address;

  console.log('Network:', await provider.getNetwork());
  const bal = await provider.getBalance(wallet.address);
  console.log('Deployer:', wallet.address, 'Balance:', ethers.formatEther(bal), 'ETH');

  console.log('Compiling DepositRegistry.sol ...');
  const reg = compileContract('DepositRegistry.sol');

  console.log('Deploying DepositRegistry ...');
  const regFactory = new ethers.ContractFactory(reg.abi, reg.bytecode, wallet);
  const regContract = await regFactory.deploy(admin, recorder);
  await regContract.waitForDeployment();
  const regAddress = await regContract.getAddress();
  console.log('DepositRegistry deployed at:', regAddress);

  const deploymentsDir = path.join(PROJECT_ROOT, 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const out = {
    network: 'base-sepolia',
    chainId: 84532,
    depositRegistry: { address: regAddress, abi: reg.abi },
    admin,
    recorder,
    timestamp: Date.now()
  };
  fs.writeFileSync(path.join(deploymentsDir, 'base-sepolia.json'), JSON.stringify(out, null, 2));
  console.log('Saved deployments to deployments/base-sepolia.json');
}

main().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});