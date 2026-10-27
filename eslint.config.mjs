import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import boundaries from 'eslint-plugin-boundaries';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    plugins: {
      boundaries,
    },
    settings: {
      // Resolve the "@/..." path alias so boundary rules can see aliased imports.
      'import/resolver': {
        typescript: { alwaysTryTypes: true, project: './tsconfig.json' },
      },
      'boundaries/include': ['src/**/*'],
      'boundaries/elements': [
        {
          type: 'app',
          pattern: ['src/app/**/*', 'src/proxy.ts'],
          mode: 'full',
        },
        {
          type: 'module',
          pattern: 'src/modules/*/**/*',
          mode: 'full',
          capture: ['moduleName'],
        },
        {
          type: 'shared',
          pattern: 'src/shared/**/*',
          mode: 'full',
        },
        {
          type: 'types',
          pattern: 'src/types/**/*',
          mode: 'full',
        },
      ],
    },
    rules: {
      'boundaries/element-types': [
        'error',
        {
          default: 'disallow',
          rules: [
            {
              from: 'app',
              allow: ['app', 'module', 'shared', 'types'],
            },
            {
              from: 'module',
              allow: ['module', 'shared', 'types'],
            },
            {
              from: 'shared',
              allow: ['shared', 'types'],
            },
            {
              from: 'types',
              allow: ['types'],
            },
          ],
        },
      ],
    },
  },
  // Enforce that only repository.ts, shared/lib/supabase, and shared/lib/rbac import Supabase clients
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/**/repository.ts',
      'src/shared/lib/supabase/**',
      'src/shared/lib/rbac/**',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'pg',
              message: 'Only repository.ts or shared/lib/supabase may import pg.',
            },
            {
              name: '@supabase/supabase-js',
              message: 'Only repository.ts or shared/lib/supabase may import @supabase/supabase-js.',
            },
            {
              name: '@supabase/ssr',
              message: 'Only repository.ts or shared/lib/supabase may import @supabase/ssr.',
            },
          ],
          patterns: [
            {
              group: ['@/shared/lib/supabase', '@/shared/lib/supabase/*'],
              message: 'Only repository.ts or shared/lib/rbac may import the Supabase client.',
            },
            {
              // Modules are consumed only through their public API: '@/modules/<name>'.
              // (Files inside a module import each other with relative paths.)
              group: ['@/modules/*/*'],
              message: "Import a module only through its public API ('@/modules/<name>').",
            },
          ],
        },
      ],
    },
  },
  // Enforce that service.ts stays framework-free (no Next.js or React imports)
  {
    files: ['src/modules/**/service.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'react',
              message: 'service.ts must remain framework-free (no React imports).',
            },
          ],
          patterns: [
            {
              group: ['next', 'next/*'],
              message: 'service.ts must remain framework-free (no Next.js imports).',
            },
            {
              group: ['@supabase/*', '@/shared/lib/supabase', '@/shared/lib/supabase/*'],
              message: 'service.ts must call repository.ts rather than importing Supabase directly.',
            },
          ],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    'tmp-next/**',
  ]),
]);

export default eslintConfig;
