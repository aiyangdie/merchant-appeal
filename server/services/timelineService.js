import timelineModel from '../models/Timeline.js';
import logger from '../utils/logger.js';

export class TimelineService {
  constructor() {
    this.logger = logger;
  }

  async recordEvent({ appealId, event, status, operator, operatorType = 'system', details = {} }) {
    return await timelineModel.create({
      appeal_id: appealId,
      event,
      status,
      operator: operator || '',
      operator_type: operatorType,
      details,
      timestamp: new Date().toISOString()
    });
  }

  async getTimeline(appealId) {
    return await timelineModel.findByAppealId(appealId);
  }

  async getTimelineFormatted(appealId) {
    const timeline = await timelineModel.findByAppealId(appealId);

    return timeline.map(item => ({
      id: item.id,
      event: item.event,
      status: item.status,
      operator: item.operator,
      operatorType: item.operator_type,
      details: item.details,
      timestamp: item.timestamp,
      formattedTime: this.formatTime(item.timestamp)
    }));
  }

  formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }
}

export default new TimelineService();
