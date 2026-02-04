/**
 * Workflow Runtime Engine (Database-Centric)
 * Listens to workflow.instances changes and computes next task via BPMN engine
 */

const { Client } = require('pg');
const { Engine } = require('bpmn-engine');
const { EventEmitter } = require('events');

class WorkflowEngine {
  constructor(dbConfig) {
    this.dbConfig = dbConfig;
    this.pgClient = null;
  }

  async initialize() {
    this.pgClient = new Client(this.dbConfig);
    await this.pgClient.connect();
  }

  async handleWorkflowEvent(payload) {
    if (!payload) return;

    let instance = null;
    try {
      instance = JSON.parse(payload);
    } catch (error) {
      console.error('❌ Invalid workflow payload:', error.message);
      return;
    }

    if (!instance?.definition_id || instance.status === 'COMPLETED') return;

    try {
      const definition = await this.getDefinition(instance.definition_id);
      if (!definition) return;

      const nextTaskId = await this.computeNextTask(
        definition.bpmn_xml,
        instance.current_task_id,
        instance.variables || {}
      );

      const nextStatus = nextTaskId ? 'ACTIVE' : 'COMPLETED';

      await this.pgClient.query(
        `UPDATE workflow.instances
         SET current_task_id = $1, status = $2
         WHERE id = $3`,
        [nextTaskId, nextStatus, instance.id]
      );
    } catch (error) {
      console.error('❌ Workflow transition error:', error.message);
    }
  }

  async getDefinition(definitionId) {
    const result = await this.pgClient.query(
      `SELECT id, bpmn_xml FROM workflow.definitions WHERE id = $1`,
      [definitionId]
    );
    return result.rows?.[0] || null;
  }

  async computeNextTask(bpmnXml, currentTaskId, variables) {
    if (!bpmnXml) return null;

    const engine = new Engine({
      name: `workflow-${Date.now()}`,
      source: bpmnXml
    });

    const listener = new EventEmitter();
    const execution = await engine.execute({
      variables: variables || {},
      listener
    });

    let postponed = execution.getPostponed();

    if (currentTaskId) {
      const target = postponed.find((item) => item.id === currentTaskId || item.activity?.id === currentTaskId);
      if (target) {
        target.signal();
        await Promise.race([
          engine.waitFor('wait'),
          engine.waitFor('end')
        ]).catch(() => null);
        postponed = execution.getPostponed();
      }
    }

    if (postponed?.length) {
      return postponed[0].id;
    }

    return null;
  }

  async shutdown() {
    if (this.pgClient) {
      await this.pgClient.end();
    }
  }
}

module.exports = { WorkflowEngine };
