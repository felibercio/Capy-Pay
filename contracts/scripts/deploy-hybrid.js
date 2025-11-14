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
  // Resolve OpenZeppelin imports and local relative imports
  try {
    if (importPath.startsWith('@openzeppelin/')) {
      const ozPath = path.join(PROJECT_ROOT, 'node_modules', importPath);
      return { contents: fs.readFileSync(ozPath, 'utf8') };
    }
    // Local imports (relative to contracts/src)
    const localPath = path.join(SRC_DIR, importPath);
    if (fs.existsSync(localPath)) {
      return { contents: fs.readFileSync(localPath, 'utf8') };
    }
    // Fallback: try relative to project root
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
    throw new Error(`No contracts output for ${sourceFile}. Check import resolution and compiler version.`);
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
  const RPC_URL = process.env.BASE_TESTNET_RPC_URL;
  const PRIVATE_KEY = process.env.PRIVATE_KEY;
  const BACKEND_MINTER_RAW = process.env.BACKEND_MINTER_ADDRESS;
  const DEPLOY_BRCAPY = (process.env.DEPLOY_BRCAPY || 'false').toLowerCase() === 'true';

  if (!RPC_URL || !PRIVATE_KEY) {
    throw new Error('Missing BASE_TESTNET_RPC_URL or PRIVATE_KEY in contracts/.env');
  }
  if (!BACKEND_MINTER_RAW) {
    console.warn('BACKEND_MINTER_ADDRESS not set, using deployer as backend minter');
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  const admin = wallet.address;
  const backendMinter = (BACKEND_MINTER_RAW && ethers.isAddress(BACKEND_MINTER_RAW))
    ? ethers.getAddress(BACKEND_MINTER_RAW)
    : admin;

  console.log('Network:', await provider.getNetwork());
  const bal = await provider.getBalance(admin);
  console.log('Deployer:', admin, 'Balance:', ethers.formatEther(bal), 'ETH');

  // Compile contracts
  console.log('Compiling CapyCoinHybrid.sol ...');
  const capy = compileContract('CapyCoinHybrid.sol');

  console.log('Deploying CapyCoinHybrid ...');
  const capyFactory = new ethers.ContractFactory(capy.abi, capy.bytecode, wallet);
  const capyContract = await capyFactory.deploy(backendMinter, admin);
  const capyReceipt = await capyContract.waitForDeployment();
  const capyAddress = await capyContract.getAddress();
  console.log('CapyCoinHybrid deployed at:', capyAddress);

  let brcapyAddress = null;
  if (DEPLOY_BRCAPY) {
    console.log('Compiling BRcapy.sol ...');
    const br = compileContract('BRcapy.sol');
    console.log('Deploying BRcapy ...');
    const brFactory = new ethers.ContractFactory(br.abi, br.bytecode, wallet);
    // Initial params aligned with DeployHybrid.s.sol
    const INITIAL_BRCAPY_VALUE = ethers.parseUnits('1.05234567', 18);
    const INITIAL_CDI_RATE = 1175;
    const INITIAL_INTERNAL_FEE = 110;
    const brContract = await brFactory.deploy(
      INITIAL_BRCAPY_VALUE,
      INITIAL_CDI_RATE,
      INITIAL_INTERNAL_FEE,
      backendMinter,
      admin
    );
    await brContract.waitForDeployment();
    brcapyAddress = await brContract.getAddress();
    console.log('BRcapy deployed at:', brcapyAddress);
  }

  // Save deployment info
  const deploymentsDir = path.join(PROJECT_ROOT, 'deployments');
  if (!fs.existsSync(deploymentsDir)) fs.mkdirSync(deploymentsDir);
  const out = {
    network: 'base-sepolia',
    chainId: 84532,
    capyCoinHybrid: { address: capyAddress, abi: capy.abi },
    brcapy: brcapyAddress ? { address: brcapyAddress } : null,
    timestamp: Date.now(),
    admin,
    backendMinter: backendMinter
  };
  fs.writeFileSync(path.join(deploymentsDir, 'base-sepolia.json'), JSON.stringify(out, null, 2));
  console.log('Saved deployments to deployments/base-sepolia.json');
}

main().catch((err) => {
  console.error('Deploy failed:', err);
  process.exit(1);
});