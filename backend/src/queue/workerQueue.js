const { config } = require('../config');

class PriorityWorkerQueue {
    constructor() {
        this.highPriorityQueue = [];
        this.normalQueue = [];
        this.activeCount = 0;
        this.maxConcurrency = config.queue.maxConcurrentInferences;
        this.totalProcessed = 0;
        this.totalWaitTimeMs = 0;
    }

    /**
     * Enqueue a task with priority
     * @param {Function} taskFn - async function to execute
     * @param {boolean} isHighPriority - whether to prioritize
     * @returns {Promise<any>}
     */
    enqueue(taskFn, isHighPriority = false) {
        return new Promise((resolve, reject) => {
            const queueItem = {
                taskFn,
                resolve,
                reject,
                enqueuedAt: Date.now()
            };

            if (isHighPriority) {
                this.highPriorityQueue.push(queueItem);
            } else {
                this.normalQueue.push(queueItem);
            }

            this.processNext();
        });
    }

    processNext() {
        if (this.activeCount >= this.maxConcurrency) {
            return;
        }

        // Pull from high-priority first, then normal
        const item = this.highPriorityQueue.shift() || this.normalQueue.shift();
        if (!item) {
            return;
        }

        this.activeCount++;
        const waitTime = Date.now() - item.enqueuedAt;
        this.totalWaitTimeMs += waitTime;

        // Execute task with timeout guardrail
        let timedOut = false;
        const timeoutTimer = setTimeout(() => {
            timedOut = true;
            this.activeCount--;
            item.reject(new Error(`Task execution timed out after ${config.queue.taskTimeoutMs}ms`));
            this.processNext();
        }, config.queue.taskTimeoutMs);

        Promise.resolve()
            .then(() => item.taskFn())
            .then(result => {
                if (!timedOut) {
                    clearTimeout(timeoutTimer);
                    this.activeCount--;
                    this.totalProcessed++;
                    item.resolve(result);
                    this.processNext();
                }
            })
            .catch(err => {
                if (!timedOut) {
                    clearTimeout(timeoutTimer);
                    this.activeCount--;
                    item.reject(err);
                    this.processNext();
                }
            });
    }

    getStats() {
        const avgWaitMs = this.totalProcessed > 0 
            ? Math.round(this.totalWaitTimeMs / this.totalProcessed) 
            : 0;

        return {
            activeWorkers: this.activeCount,
            maxConcurrency: this.maxConcurrency,
            queuedTasks: this.highPriorityQueue.length + this.normalQueue.length,
            highPriorityQueued: this.highPriorityQueue.length,
            totalProcessed: this.totalProcessed,
            avgWaitTimeMs: avgWaitMs
        };
    }
}

const workerQueue = new PriorityWorkerQueue();

module.exports = { workerQueue };
