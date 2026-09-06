-- Combined Init SQL for environments mounting single init file
SELECT 'CREATE DATABASE devtools' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'devtools')\gexec
SELECT 'CREATE DATABASE ecommerce' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'ecommerce')\gexec
