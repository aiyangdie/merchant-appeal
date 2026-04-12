import nodemailer from 'nodemailer';

const SMTP_CONFIG = {
  host: 'smtp.qq.com',
  port: 465,
  secure: true,
  auth: {
    user: 'aike1015@qq.com',
    pass: 'mztzvrxhwmridhjj'
  }
};

let transporter = null;

export function initEmailService() {
  transporter = nodemailer.createTransport(SMTP_CONFIG);
  console.log('📧 邮件服务已初始化 (SMTP: smtp.qq.com:465)');
  return transporter;
}

export function getTransporter() {
  if (!transporter) {
    initEmailService();
  }
  return transporter;
}

export async function sendEmail({ to, subject, html, text }) {
  try {
    const transport = getTransporter();
    const result = await transport.sendMail({
      from: `"商户号申诉助手" <aike1015@qq.com>`,
      to: to || 'aike1015@qq.com',
      subject: subject || '商户号申诉助手通知',
      html: html || '',
      text: text || ''
    });
    console.log('📧 邮件发送成功:', result.messageId);
    return { success: true, messageId: result.messageId };
  } catch (error) {
    console.error('📧 邮件发送失败:', error.message);
    return { success: false, error: error.message };
  }
}

export async function checkNewEmails() {
  console.log('📧 检查新邮件...');
  try {
    const transport = getTransporter();

    const testConnection = await transport.verify();
    console.log('📧 SMTP连接状态:', testConnection);

    return { success: true, connected: testConnection };
  } catch (error) {
    console.error('📧 邮件服务检查失败:', error.message);
    return { success: false, error: error.message };
  }
}

export default {
  initEmailService,
  getTransporter,
  sendEmail,
  checkNewEmails
};
