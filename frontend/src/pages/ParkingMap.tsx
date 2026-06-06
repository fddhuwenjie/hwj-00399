import React, { useState, useEffect, useMemo } from 'react';
import {
  Row,
  Col,
  Card,
  Button,
  Radio,
  Select,
  Modal,
  Descriptions,
  Tag,
  Statistic,
  Space,
  message
} from 'antd';
import { CarOutlined, EnvironmentOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { configApi, spaceApi, recordApi } from '../services/api';
import type { ParkingConfig, ParkingSpace, ParkingRecord, SpaceType, SpaceStatus } from '../types';

const { Option } = Select;

const spaceTypeLabels: Record<SpaceType, string> = {
  normal: '普通',
  disabled: '残疾人',
  vip: 'VIP',
  charging: '充电桩'
};

const spaceStatusLabels: Record<SpaceStatus, string> = {
  available: '空闲',
  occupied: '已占用',
  reserved: '已预约'
};

const spaceStatusColors: Record<SpaceStatus, string> = {
  available: 'success',
  occupied: 'error',
  reserved: 'warning'
};

const ParkingMap: React.FC = () => {
  const [config, setConfig] = useState<ParkingConfig | null>(null);
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [currentFloor, setCurrentFloor] = useState<number>(1);
  const [filterType, setFilterType] = useState<SpaceType | 'all'>('all');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [parkingRecord, setParkingRecord] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    fetchSpaces();
    const interval = setInterval(fetchSpaces, 10000);
    return () => clearInterval(interval);
  }, [currentFloor]);

  const fetchConfig = async () => {
    try {
      const response = await configApi.getConfig();
      if (response.success && response.data) {
        setConfig(response.data);
      }
    } catch (error) {
      message.error('获取配置失败');
    }
  };

  const fetchSpaces = async () => {
    try {
      setLoading(true);
      const response = await spaceApi.getSpacesByFloor(currentFloor);
      if (response.success && response.data) {
        setSpaces(response.data);
      }
    } catch (error) {
      message.error('获取车位数据失败');
    } finally {
      setLoading(false);
    }
  };

  const floorStats = useMemo(() => {
    const stats = spaces.reduce(
      (acc, space) => {
        acc.total++;
        acc[space.status]++;
        return acc;
      },
      { total: 0, available: 0, occupied: 0, reserved: 0 }
    );
    return stats;
  }, [spaces]);

  const filteredSpaces = useMemo(() => {
    if (filterType === 'all') return spaces;
    return spaces.filter(space => space.type === filterType);
  }, [spaces, filterType]);

  const gridStyle = useMemo(() => {
    if (filteredSpaces.length === 0) return {};
    const maxCol = Math.max(...filteredSpaces.map(s => s.col)) + 1;
    const maxRow = Math.max(...filteredSpaces.map(s => s.row)) + 1;
    return {
      gridTemplateColumns: `repeat(${maxCol}, 80px)`,
      gridTemplateRows: `repeat(${maxRow}, 40px)`
    };
  }, [filteredSpaces]);

  const handleSpaceClick = async (space: ParkingSpace) => {
    setSelectedSpace(space);
    setParkingRecord(null);
    setModalVisible(true);

    if (space.status === 'occupied') {
      try {
        const response = await recordApi.getParkingCars();
        if (response.success && response.data) {
          const record = response.data.find(r => r.spaceId === space.id);
          setParkingRecord(record || null);
        }
      } catch (error) {
        console.error('获取停车记录失败', error);
      }
    }
  };

  const getSpaceItemStyle = (space: ParkingSpace) => {
    return {
      gridColumn: space.col + 1,
      gridRow: space.row + 1
    };
  };

  const renderFloorButtons = () => {
    if (!config) return null;
    const buttons = [];
    for (let i = 1; i <= config.floors; i++) {
      buttons.push(
        <Button
          key={i}
          type={currentFloor === i ? 'primary' : 'default'}
          onClick={() => setCurrentFloor(i)}
        >
          {i}层
        </Button>
      );
    }
    return buttons;
  };

  return (
    <div>
      <Card title="实时车位地图" style={{ marginBottom: 16 }}>
        <Row gutter={[16, 16]}>
          <Col xs={24} md={6}>
            <Card className="stats-card">
              <Statistic
                title="总车位"
                value={floorStats.total}
                prefix={<EnvironmentOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="stats-card">
              <Statistic
                title="空闲"
                value={floorStats.available}
                valueStyle={{ color: '#52c41a' }}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="stats-card">
              <Statistic
                title="已占用"
                value={floorStats.occupied}
                valueStyle={{ color: '#f5222d' }}
                prefix={<CarOutlined />}
              />
            </Card>
          </Col>
          <Col xs={24} md={6}>
            <Card className="stats-card">
              <Statistic
                title="已预约"
                value={floorStats.reserved}
                valueStyle={{ color: '#faad14' }}
                prefix={<InfoCircleOutlined />}
              />
            </Card>
          </Col>
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <span>楼层选择</span>
            <Radio.Group className="space-floor-switch">
              <Radio.Button value={1} onClick={() => setCurrentFloor(1)}>1层</Radio.Button>
              <Radio.Button value={2} onClick={() => setCurrentFloor(2)}>2层</Radio.Button>
              <Radio.Button value={3} onClick={() => setCurrentFloor(3)}>3层</Radio.Button>
            </Radio.Group>
          </Space>
        }
        extra={
          <Space>
            <span>类型筛选:</span>
            <Select
              value={filterType}
              onChange={(value) => setFilterType(value)}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="normal">普通</Option>
              <Option value="disabled">残疾人</Option>
              <Option value="vip">VIP</Option>
              <Option value="charging">充电桩</Option>
            </Select>
          </Space>
        }
      >
        <div style={{ marginBottom: 16 }}>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#52c41a' }}></div>
            <span>空闲</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#f5222d' }}></div>
            <span>已占用</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#faad14' }}></div>
            <span>已预约</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#fff', border: '2px solid #d9d9d9' }}></div>
            <span>普通车位</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#fff', border: '2px solid #1890ff' }}></div>
            <span>♿ 残疾人车位</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#fff', border: '2px solid #eb2f96' }}></div>
            <span>VIP 车位</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#fff', border: '2px solid #13c2c2' }}></div>
            <span>⚡ 充电桩</span>
          </div>
        </div>

        <div
          className="space-grid"
          style={{
            ...gridStyle,
            justifyItems: 'center',
            alignItems: 'center'
          }}
        >
          {filteredSpaces.map(space => (
            <div
              key={space.id}
              className={`space-item space-${space.status} space-${space.type}`}
              style={getSpaceItemStyle(space)}
              onClick={() => handleSpaceClick(space)}
            >
              {space.spaceNo.split('-')[1]}
            </div>
          ))}
        </div>
      </Card>

      <Modal
        title="车位详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        {selectedSpace && (
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="车位号">
              <Tag color="blue">{selectedSpace.spaceNo}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="楼层">
              {selectedSpace.floor}层
            </Descriptions.Item>
            <Descriptions.Item label="类型">
              <Tag color={selectedSpace.type === 'normal' ? 'default' : selectedSpace.type === 'disabled' ? 'blue' : selectedSpace.type === 'vip' ? 'magenta' : 'cyan'}>
                {spaceTypeLabels[selectedSpace.type]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={spaceStatusColors[selectedSpace.status]}>
                {spaceStatusLabels[selectedSpace.status]}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="位置">
              第 {selectedSpace.row + 1} 行，第 {selectedSpace.col + 1} 列
            </Descriptions.Item>
          </Descriptions>
        )}

        {selectedSpace?.status === 'occupied' && parkingRecord && (
          <Card title="当前车辆信息" style={{ marginTop: 16 }} size="small">
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="车牌号">
                <span className="plate-display" style={{ fontSize: 20, padding: 10 }}>
                  {parkingRecord.plateNo}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="入场时间">
                {parkingRecord.entryTime}
              </Descriptions.Item>
              {parkingRecord.memberName && (
                <Descriptions.Item label="会员">
                  <span className="member-badge">{parkingRecord.memberName}</span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        )}

        {selectedSpace?.status === 'occupied' && !parkingRecord && (
          <Card title="当前车辆信息" style={{ marginTop: 16 }} size="small">
            <p style={{ color: '#999', textAlign: 'center', padding: 20 }}>
              暂无车辆信息
            </p>
          </Card>
        )}
      </Modal>
    </div>
  );
};

export default ParkingMap;
