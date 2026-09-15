const express = require('express');
const cors = require('cors');
const { processRequest } = require('./services/orchestrator');
const { pool } = require('./src/db');

const app = express();
app.use(cors());
app.use(express.json());

app.post('/api/process-intent', async (req, res) => {
    try {
        const { input } = req.body;
        if (!input) return res.status(400).json({ error: 'Input required' });

        const result = await processRequest(input);
        res.json(result);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
});

// New endpoints for dashboard
app.get('/api/tickets', async (req, res) => {
    try {
        const { rows } = await pool.query('SELECT * FROM tickets ORDER BY created_at DESC');
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'DB Error' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const ticketRes = await pool.query('SELECT * FROM tickets WHERE id = $1', [id]);
        if (ticketRes.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const logsRes = await pool.query('SELECT * FROM logs WHERE ticket_id = $1 ORDER BY created_at ASC', [id]);
        const transRes = await pool.query('SELECT * FROM transactions WHERE ticket_id = $1', [id]);

        res.json({
            ticket: ticketRes.rows[0],
            logs: logsRes.rows,
            transactions: transRes.rows
        });
    } catch (error) {
        res.status(500).json({ error: 'DB Error' });
    }
});

const PORT = 3001;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));
