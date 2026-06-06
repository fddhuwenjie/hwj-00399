import { useEffect, useState } from 'react';
import { Row, Col, Card, Statistic, Progress, List, Tag, Table, Spin, message, Space } from 'antd';
import { DollarOutlined, CarOutlined, TeamOutlined, CalendarOutlined, WarningOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { statsApi, spaceApi, memberApi, recordApi } from '../services/api';
import type { DashboardData, Member, ParkingRecord } from '../types';
import { formatDateTime, spaceTypeMap, memberTypeMap } from '../utils';

function Dashboard() {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [spaceStats, setSpaceStats] = useState<{ total: number; available: number; occupied: number; reserved: number } | null>(null);
  const [expiringMembers, setExpiringMembers] = useState<Member[]>([]);
  const [parkingCars, setParkingCars] = useState<ParkingRecord[]>([]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, spaceRes, membersRes, carsRes] = await Promise.all([
        statsApi.getDashboard(),
        spaceApi.getSpaceStats(),
        memberApi.getExpiring(),
        recordApi.getParkingCars()
      ]);

      if (dashboardRes.success && dashboardRes.data) {
        setDashboardData(dashboardRes.data);
      }
      if (spaceRes.success && spaceRes.data) {
        setSpaceStats(spaceRes.data.total);
      }
      if (membersRes.success && membersRes.data) {
        setExpiringMembers(membersRes.data);
      }
      if (carsRes.success && carsRes.data) {
        setParkingCars(carsRes.data);
      }
    } catch (error) {
      message.error('获取仪表盘数据失败，请稍后重试');
      console.error('Dashboard fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    const timer = setInterval(fetchDashboardData, 30000);
    return () => clearInterval(timer);
  }, []);

  const parkingCarColumns: ColumnsType<ParkingRecord> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text: string) => <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600 }}>{text}</span>
    },
    {
      title: '车位号',
      dataIndex: 'spaceNo',
      key: 'spaceNo',
      width: 100
    },
    {
      title: '入场时间',
      dataIndex: 'entryTime',
      key: 'entryTime',
      width: 180,
      render: (text: string) => formatDateTime(text)
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
      width: 80,
      render: (floor: number) => `B${floor}层`
    },
    {
      title: '车位类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => type ? spaceTypeMap[type as keyof typeof spaceTypeMap] || type : '-'
    }
  ];

  const getMemberDaysColor = (days: number | undefined) => {
    if (days === undefined) return 'default';
    if (days <= 3) return 'red';
    if (days <= 7) return 'orange';
    return 'gold';
  };

  return (
    <div style={{ padding: '24px', background: '#f0f2f5', minHeight: '100%' }}>
      <Spin spinning={loading} tip="数据加载中...">
        <div style={{ marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: 600, color: '#262626' }}>停车场管理仪表盘</h2>
          <p style={{ margin: '8px 0 0 0', color: '#8c8c8c' }}>实时监控停车场运营数据，每30秒自动刷新</p>
        </div>

        <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>今日收入</span>}
                value={dashboardData?.todayIncome || 0}
                precision={2}
                prefix={<DollarOutlined style={{ color: '#fff' }} />}
                suffix="元"
                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>本周收入</span>}
                value={dashboardData?.weekIncome || 0}
                precision={2}
                prefix={<DollarOutlined style={{ color: '#fff' }} />}
                suffix="元"
                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>本月收入</span>}
                value={dashboardData?.monthIncome || 0}
                precision={2}
                prefix={<DollarOutlined style={{ color: '#fff' }} />}
                suffix="元"
                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>今日出场</span>}
                value={dashboardData?.todayCount || 0}
                prefix={<CarOutlined style={{ color: '#fff' }} />}
                suffix="辆"
                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: '14px' }}>当前在场</span>}
                value={dashboardData?.parkingCount || 0}
                prefix={<CarOutlined style={{ color: '#fff' }} />}
                suffix="辆"
                valueStyle={{ color: '#fff', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={8} lg={4}>
            <Card
              className="stats-card"
              style={{
                background: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
                borderRadius: '12px',
                border: 'none'
              }}
              bodyStyle={{ padding: '24px' }}
            >
              <Statistic
                title={<span style={{ color: '#666', fontSize: '14px' }}>会员总数</span>}
                value={dashboardData?.memberCount || 0}
                prefix={<TeamOutlined style={{ color: '#667eea' }} />}
                suffix="人"
                valueStyle={{ color: '#667eea', fontSize: '28px', fontWeight: 600 }}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]}>
          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <CalendarOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 600 }}>车位使用率</span>
                </Space>
              }
              style={{ borderRadius: '12px', height: '100%' }}
              bodyStyle={{ padding: '24px' }}
            >
              <div style={{ textAlign: 'center', marginBottom: '24px' }}>
                <div style={{ fontSize: '14px', color: '#8c8c8c', marginBottom: '8px' }}>总车位数</div>
                <div style={{ fontSize: '36px', fontWeight: 700, color: '#262626' }}>{spaceStats?.total || 0}</div>
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#52c41a', fontWeight: 500 }}>空闲</span>
                  <span style={{ color: '#52c41a', fontWeight: 600 }}>{spaceStats?.available || 0} 个</span>
                </div>
                <Progress
                  percent={spaceStats?.total ? Math.round((spaceStats.available / spaceStats.total) * 100) : 0}
                  strokeColor="#52c41a"
                  showInfo={false}
                  strokeWidth={12}
                />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#f5222d', fontWeight: 500 }}>已占用</span>
                  <span style={{ color: '#f5222d', fontWeight: 600 }}>{spaceStats?.occupied || 0} 个</span>
                </div>
                <Progress
                  percent={spaceStats?.total ? Math.round((spaceStats.occupied / spaceStats.total) * 100) : 0}
                  strokeColor="#f5222d"
                  showInfo={false}
                  strokeWidth={12}
                />
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <span style={{ color: '#faad14', fontWeight: 500 }}>预约中</span>
                  <span style={{ color: '#faad14', fontWeight: 600 }}>{spaceStats?.reserved || 0} 个</span>
                </div>
                <Progress
                  percent={spaceStats?.total ? Math.round((spaceStats.reserved / spaceStats.total) * 100) : 0}
                  strokeColor="#faad14"
                  showInfo={false}
                  strokeWidth={12}
                />
              </div>
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <WarningOutlined style={{ color: '#faad14' }} />
                  <span style={{ fontWeight: 600 }}>到期会员提醒</span>
                  {expiringMembers.length > 0 && (
                    <Tag color="red" style={{ marginLeft: '8px' }}>{expiringMembers.length} 位</Tag>
                  )}
                </Space>
              }
              style={{ borderRadius: '12px', height: '100%' }}
              bodyStyle={{ padding: '16px 24px' }}
            >
              {expiringMembers.length > 0 ? (
                <List
                  dataSource={expiringMembers}
                  renderItem={(member) => (
                    <List.Item
                      key={member.id}
                      style={{
                        padding: '12px 0',
                        borderBottom: '1px solid #f0f0f0',
                        background: member.daysRemaining !== undefined && member.daysRemaining <= 3
                          ? 'rgba(255,77,79,0.05)'
                          : 'transparent'
                      }}
                    >
                      <List.Item.Meta
                        title={
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontWeight: 500 }}>{member.name}</span>
                            <Tag color="blue">{memberTypeMap[member.memberType]}</Tag>
                          </div>
                        }
                        description={
                          <div style={{ fontSize: '12px', color: '#8c8c8c' }}>
                            <div>车牌：{member.plateNo}</div>
                            <div>到期：{formatDateTime(member.endDate)}</div>
                          </div>
                        }
                      />
                      <Tag color={getMemberDaysColor(member.daysRemaining)}>
                        {member.daysRemaining !== undefined ? `${member.daysRemaining}天后到期` : '即将到期'}
                      </Tag>
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                  <TeamOutlined style={{ fontSize: '48px', marginBottom: '12px', opacity: 0.3 }} />
                  <p>暂无即将到期的会员</p>
                </div>
              )}
            </Card>
          </Col>

          <Col xs={24} lg={8}>
            <Card
              title={
                <Space>
                  <CarOutlined style={{ color: '#1890ff' }} />
                  <span style={{ fontWeight: 600 }}>当前在场车辆</span>
                  <Tag color="blue" style={{ marginLeft: '8px' }}>{parkingCars.length} 辆</Tag>
                </Space>
              }
              style={{ borderRadius: '12px', height: '100%' }}
              bodyStyle={{ padding: '0' }}
            >
              <Table
                columns={parkingCarColumns}
                dataSource={parkingCars}
                rowKey="id"
                size="middle"
                pagination={false}
                scroll={{ y: 380 }}
                locale={{ emptyText: '暂无在场车辆' }}
              />
            </Card>
          </Col>
        </Row>
      </Spin>
    </div>
  );
}

export default Dashboard;
