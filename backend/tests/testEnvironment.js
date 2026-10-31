export const TEST_JWT_SECRET = 'secret-used-only-by-the-test-suite';

process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '5432';
process.env.DB_NAME = 'unused_in_tests';
process.env.DB_USER = 'unused_in_tests';
process.env.DB_PASSWORD = 'unused_in_tests';
process.env.JWT_SECRET = TEST_JWT_SECRET;
