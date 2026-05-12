module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/*.test.js'],
  collectCoverageFrom: [
    'services/**/*.js',
    'models/**/*.js',
    'controllers/**/*.js',
    'middleware/**/*.js',
    '!app.js',
  ],
};