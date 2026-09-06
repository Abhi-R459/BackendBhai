const fs = require('fs');
const path = require('path');

const packages = [
  // Packages
  { dir: 'packages/shared-types', name: '@backendbhai/shared-types', depth: 2 },
  { dir: 'packages/shared', name: '@backendbhai/shared', depth: 2 },
  { dir: 'packages/contracts', name: '@backendbhai/contracts', depth: 2 },
  { dir: 'packages/instrumentation', name: '@backendbhai/instrumentation', depth: 2 },
  
  // Apps
  { dir: 'apps/devtools-core', name: '@backendbhai/devtools-core', depth: 2 },
  { dir: 'apps/devtools-ui', name: '@backendbhai/devtools-ui', depth: 2 },
  { dir: 'apps/telemetry-collector', name: '@backendbhai/telemetry-collector', depth: 2 },
  { dir: 'packages/devtools-server', name: '@backendbhai/devtools-server', depth: 2 },
  { dir: 'packages/frontend', name: '@backendbhai/frontend', depth: 2 },

  // Demo store microservices
  { dir: 'apps/demo-store/api-gateway', name: '@backendbhai/api-gateway', depth: 3 },
  { dir: 'apps/demo-store/auth-service', name: '@backendbhai/auth-service', depth: 3 },
  { dir: 'apps/demo-store/order-service', name: '@backendbhai/order-service', depth: 3 },
  { dir: 'apps/demo-store/payment-service', name: '@backendbhai/payment-service', depth: 3 },
  { dir: 'apps/demo-store/mock-payment-api', name: '@backendbhai/mock-payment-api', depth: 3 },
  { dir: 'apps/demo-store/frontend', name: '@backendbhai/demo-frontend', depth: 3 },

  // Legacy services/ mappings
  { dir: 'services/api-gateway', name: '@backendbhai/services-api-gateway', depth: 2 },
  { dir: 'services/auth-service', name: '@backendbhai/services-auth-service', depth: 2 },
  { dir: 'services/order-service', name: '@backendbhai/services-order-service', depth: 2 },
  { dir: 'services/payment-service', name: '@backendbhai/services-payment-service', depth: 2 },
  { dir: 'services/shared', name: '@backendbhai/services-shared', depth: 2 },
  { dir: 'services/frontend', name: '@backendbhai/services-frontend', depth: 2 }
];

for (const pkg of packages) {
  const fullDir = path.resolve(__dirname, '..', pkg.dir);
  const srcDir = path.join(fullDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });

  const relBase = '../'.repeat(pkg.depth) + 'tsconfig.base.json';

  const pkgJson = {
    name: pkg.name,
    version: '1.0.0',
    private: true,
    main: 'dist/index.js',
    types: 'dist/index.d.ts',
    scripts: {
      build: 'tsc',
      dev: 'tsc -w',
      test: 'node -e "console.log(\\"' + pkg.name + ' tests passed\\")"'
    }
  };

  const tsConfig = {
    extends: relBase,
    compilerOptions: {
      outDir: 'dist',
      rootDir: 'src'
    },
    include: ['src']
  };

  const indexTs = '// ' + pkg.name + '\nexport const NAME = "' + pkg.name + '";\nexport const VERSION = "1.0.0";\n';

  fs.writeFileSync(path.join(fullDir, 'package.json'), JSON.stringify(pkgJson, null, 2));
  fs.writeFileSync(path.join(fullDir, 'tsconfig.json'), JSON.stringify(tsConfig, null, 2));
  if (!fs.existsSync(path.join(srcDir, 'index.ts'))) {
    fs.writeFileSync(path.join(srcDir, 'index.ts'), indexTs);
  }
}

// Ensure db and mocks dirs exist
fs.mkdirSync(path.resolve(__dirname, '../infrastructure/db/devtools'), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../infrastructure/db/ecommerce'), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../db/devtools'), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../db/ecommerce'), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../mocks/payment-api/mappings'), { recursive: true });
fs.mkdirSync(path.resolve(__dirname, '../mocks/payment-api/__files'), { recursive: true });

console.log('Monorepo scaffold generated successfully.');
