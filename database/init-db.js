const { Client } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function initDb() {
    const client = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        database: 'postgres'
    });

    try {
        await client.connect();
        const res = await client.query(`SELECT datname FROM pg_catalog.pg_database WHERE datname = 'ai_orchestrator'`);
        if (res.rowCount === 0) {
            console.log('Creating database ai_orchestrator...');
            await client.query(`CREATE DATABASE ai_orchestrator`);
        } else {
            console.log('Database ai_orchestrator already exists.');
        }
    } catch (err) {
        console.error('Error creating database:', err.message);
    } finally {
        await client.end();
    }

    // Connect to the new database and run schema
    const dbClient = new Client({
        user: process.env.DB_USER || 'postgres',
        host: process.env.DB_HOST || 'localhost',
        password: process.env.DB_PASSWORD || 'postgres',
        port: process.env.DB_PORT || 5432,
        database: 'ai_orchestrator'
    });

    try {
        await dbClient.connect();
        const schemaSql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
        await dbClient.query(schemaSql);
        console.log('Schema executed successfully.');
    } catch (err) {
        console.error('Error executing schema:', err.message);
    } finally {
        await dbClient.end();
    }
}

initDb();
