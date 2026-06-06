import express from 'express';
import cors from 'cors';
import { initDatabase } from './database';
import routes from './routes';
import { checkExpiredReservations } from './controllers/reservationController';

const app = express();
const PORT = 8399;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const startServer = async () => {
  await initDatabase();
  console.log('数据库初始化完成');

  setInterval(() => {
    checkExpiredReservations();
  }, 60000);

  app.use('/api', routes);

  app.get('/api/health', (req, res) => {
    res.json({ success: true, message: '停车场管理系统后端服务运行正常', timestamp: new Date().toISOString() });
  });

  app.listen(PORT, () => {
    console.log(`🚀 停车场管理系统后端服务已启动: http://localhost:${PORT}`);
    console.log(`📊 API 文档: http://localhost:${PORT}/api/health`);
  });
};

startServer();

export default app;
