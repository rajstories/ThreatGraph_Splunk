const neo4j = require('neo4j-driver');
require('dotenv').config();

const driver = neo4j.driver(
  'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', 'password123')
);

module.exports = driver;
