import db from '../config/database.js';
import { safeParse } from '../utils/jsonHelper.js';

class KnowledgeBaseModel {
  constructor() {
    this.caseTable = 'success_cases';
    this.snippetTable = 'knowledge_snippets';
  }

  /**
   * Find similar success cases based on industry and violation
   * @param {string} industry 
   * @param {string} problemType 
   * @param {string} violationReason 
   * @param {number} limit 
   */
  async findSimilarCases(industry, problemType, violationReason, limit = 3) {
    let sql = `SELECT * FROM ${this.caseTable} WHERE status = 'active'`;
    const params = [];
    const conditions = [];

    // Basic keyword matching
    if (industry) {
      conditions.push(`industry LIKE ?`);
      params.push(`%${industry}%`);
    }
    
    if (problemType) {
      conditions.push(`problem_type LIKE ?`);
      params.push(`%${problemType}%`);
    }
    
    // For violation_reason, we check the JSON collected_data
    if (violationReason) {
       conditions.push(`collected_data->>'$.violation_reason' LIKE ?`);
       params.push(`%${violationReason}%`);
    }

    if (conditions.length > 0) {
      sql += ' AND (' + conditions.join(' OR ') + ')';
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit + 5); // Fetch a bit more to sort by score in memory

    const rows = await db.query(sql, params);
    const processedRows = rows.map(this._processCaseRow);
    
    // In-memory scoring (same logic as before) to rank them
    return this._rankCases(processedRows, industry, problemType, violationReason).slice(0, limit);
  }

  async getViolationKnowledge(violationReason) {
    if (!violationReason) return null;
    
    // Fetch all violation snippets to match aliases
    const sql = `SELECT * FROM ${this.snippetTable} WHERE category = 'violation'`;
    const rows = await db.query(sql);
    
    const term = violationReason.toLowerCase();
    
    for (const row of rows) {
      const info = safeParse(row.content);
      if (info && info.aliases && Array.isArray(info.aliases)) {
        if (info.aliases.some(a => term.includes(a.toLowerCase()))) {
          return { key: row.snippet_key, ...info };
        }
      }
    }
    
    return null;
  }
  
  _processCaseRow(row) {
    const data = safeParse(row.collected_data) || {};
    return {
      id: row.id,
      title: row.title,
      industry: row.industry,
      problem_type: row.problem_type,
      violation_reason: data.violation_reason || '',
      success_summary: row.success_summary,
      key_strategy: row.admin_notes, // We stored key_strategy here
      appeal_points: data.appeal_points || [],
      difficulty: data.difficulty,
      timeline: data.timeline,
      ...data // spread other data
    };
  }

  _rankCases(cases, industry, problemType, violationReason) {
    if (!cases.length) return [];
    
    const pt = (problemType || '').toLowerCase();
    const ind = (industry || '').toLowerCase();
    const vr = (violationReason || '').toLowerCase();

    return cases.map(c => {
      let score = 0;
      const cpt = (c.problem_type || '').toLowerCase();
      const cind = (c.industry || '').toLowerCase();
      const cvr = (c.violation_reason || '').toLowerCase();
      
      if (pt && cpt.includes(pt)) score += 5;
      if (pt && pt.includes(cpt)) score += 3;
      
      if (vr && cvr.includes(vr)) score += 4;
      if (vr && vr.includes(cvr)) score += 2;
      
      if (ind && cind.includes(ind)) score += 2;
      if (ind && ind.includes(cind)) score += 1;
      
      return { ...c, _score: score };
    })
    .filter(c => c._score > 0)
    .sort((a, b) => b._score - a._score);
  }
}

export default new KnowledgeBaseModel();
