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
  message,
  Input,
  Form,
  Alert,
  Steps,
  Result
} from 'antd';
import {
  CarOutlined,
  EnvironmentOutlined,
  InfoCircleOutlined,
  ArrowRightOutlined,
  CheckCircleOutlined,
  HistoryOutlined,
  ThunderboltOutlined
} from '@ant-design/icons';
import { configApi, spaceApi, recordApi, guidanceApi } from '../services/api';
import type {
  ParkingConfig,
  ParkingSpace,
  ParkingRecord,
  SpaceType,
  SpaceStatus,
  GuidanceResult,
  Member
} from '../types';

const { Option } = Select;
const { Step } = Steps;
const { Search } = Input;

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

const typePreferenceOptions = [
  { value: 'all', label: '无偏好' },
  { value: 'charging', label: '优先充电桩' },
  { value: 'vip', label: '优先VIP车位' },
  { value: 'disabled', label: '优先残疾人车位' }
];

const ParkingMap: React.FC = () => {
  const [config, setConfig] = useState<ParkingConfig | null>(null);
  const [spaces, setSpaces] = useState<ParkingSpace[]>([]);
  const [currentFloor, setCurrentFloor] = useState<number>(1);
  const [filterType, setFilterType] = useState<SpaceType | 'all'>('all');
  const [modalVisible, setModalVisible] = useState<boolean>(false);
  const [selectedSpace, setSelectedSpace] = useState<ParkingSpace | null>(null);
  const [parkingRecord, setParkingRecord] = useState<ParkingRecord | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const [guidanceModalVisible, setGuidanceModalVisible] = useState(false);
  const [guidanceLoading, setGuidanceLoading] = useState(false);
  const [guidanceResult, setGuidanceResult] = useState<GuidanceResult | null>(null);
  const [typePreference, setTypePreference] = useState('all');
  const [entryPlateNo, setEntryPlateNo] = useState('');
  const [entryStep, setEntryStep] = useState(0);
  const [guidanceForm] = Form.useForm();
  const [entryResult, setEntryResult] = useState<{
    record: ParkingRecord;
    member?: Member;
    guidance: GuidanceResult;
  } | null>(null);

  const [highlightPath, setHighlightPath] = useState<Set<string>>(new Set());
  const [recommendedSpaceId, setRecommendedSpaceId] = useState<number | null>(null);

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

  const handleRecommendSpace = async () => {
    try {
      setGuidanceLoading(true);
      const res = await guidanceApi.recommend({
        plateNo: entryPlateNo || undefined,
        typePreference: typePreference === 'all' ? undefined : typePreference
      });

      if (res.success && res.data) {
        setGuidanceResult(res.data);
        setCurrentFloor(res.data.floor);

        const pathSet = new Set(res.data.path.map(p => `${p.row}-${p.col}`));
        setHighlightPath(pathSet);
        setRecommendedSpaceId(res.data.space.id);

        setTimeout(() => {
          fetchSpaces();
        }, 100);

        setEntryStep(1);
        message.success(`已为您推荐最优车位：${res.data.spaceNo}`);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '获取推荐车位失败');
    } finally {
      setGuidanceLoading(false);
    }
  };

  const handleConfirmEntry = async () => {
    if (!guidanceResult) return;

    try {
      setGuidanceLoading(true);
      const res = await guidanceApi.entry({
        plateNo: entryPlateNo || undefined,
        spaceId: guidanceResult.space.id,
        typePreference: typePreference === 'all' ? undefined : typePreference,
        manual: !!entryPlateNo
      });

      if (res.success && res.data) {
        setEntryResult(res.data);
        setEntryStep(2);
        message.success('车辆入场成功！');
        setTimeout(() => {
          fetchSpaces();
        }, 100);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '入场失败');
    } finally {
      setGuidanceLoading(false);
    }
  };

  const handleShowPath = async (space: ParkingSpace) => {
    try {
      const res = await guidanceApi.getPath(space.id);
      if (res.success && res.data) {
        const pathSet = new Set(res.data.path.map(p => `${p.row}-${p.col}`));
        setHighlightPath(pathSet);
        setRecommendedSpaceId(space.id);
        setCurrentFloor(space.floor);
        message.info(`已显示前往 ${space.spaceNo} 的路线`);
      }
    } catch (error) {
      message.error('获取路线失败');
    }
  };

  const clearHighlight = () => {
    setHighlightPath(new Set());
    setRecommendedSpaceId(null);
  };

  const resetGuidance = () => {
    setGuidanceModalVisible(false);
    setGuidanceResult(null);
    setEntryStep(0);
    setEntryResult(null);
    setEntryPlateNo('');
    setTypePreference('all');
    clearHighlight();
    guidanceForm.resetFields();
  };

  const getSpaceItemStyle = (space: ParkingSpace) => {
    return {
      gridColumn: space.col + 1,
      gridRow: space.row + 1
    };
  };

  const isPathCell = (row: number, col: number) => {
    return highlightPath.has(`${row}-${col}`);
  };

  const isRecommendedSpace = (spaceId: number) => {
    return recommendedSpaceId === spaceId;
  };

  const getSpaceClass = (space: ParkingSpace) => {
    let classes = `space-item space-${space.status} space-${space.type}`;
    if (isRecommendedSpace(space.id)) {
      classes += ' space-recommended';
    }
    return classes;
  };

  const renderGuidanceSteps = () => {
    if (entryStep === 0) {
      return (
        <div>
          <Alert
            message="智能车位引导"
            description="系统将为您推荐距离电梯最近的空闲车位，支持按车位类型偏好筛选"
            type="info"
            showIcon
            style={{ marginBottom: 24 }}
          />
          <Form form={guidanceForm} layout="vertical">
            <Form.Item
              name="plateNo"
              label="车牌号（可选，随机生成）"
            >
              <Input
                placeholder="请输入车牌号，不填则随机生成"
                value={entryPlateNo}
                onChange={(e) => setEntryPlateNo(e.target.value.toUpperCase())}
                maxLength={8}
              />
            </Form.Item>
            <Form.Item
              name="typePreference"
              label="车位类型偏好"
              initialValue="all"
            >
              <Select value={typePreference} onChange={setTypePreference}>
                {typePreferenceOptions.map(opt => (
                  <Option key={opt.value} value={opt.value}>{opt.label}</Option>
                ))}
              </Select>
            </Form.Item>
            <Form.Item>
              <Button
                type="primary"
                size="large"
                block
                icon={<CarOutlined />}
                onClick={handleRecommendSpace}
                loading={guidanceLoading}
              >
                推荐最优车位
              </Button>
            </Form.Item>
          </Form>
        </div>
      );
    }

    if (entryStep === 1 && guidanceResult) {
      return (
        <div>
          <Result
            icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
            title="车位推荐成功"
            subTitle={
              <div style={{ textAlign: 'left' }}>
                <Card
                  style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    borderRadius: 12,
                    border: 'none',
                    marginBottom: 16
                  }}
                  bodyStyle={{ padding: 20 }}
                >
                  <Statistic
                    title={<span style={{ color: 'rgba(255,255,255,0.85)' }}>推荐车位</span>}
                    value={guidanceResult.spaceNo}
                    prefix={<EnvironmentOutlined style={{ color: '#fff' }} />}
                    valueStyle={{ color: '#fff', fontSize: 32, fontWeight: 700 }}
                  />
                </Card>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="所在楼层">
                    <Tag color="blue">B{guidanceResult.floor}层</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="所在区域">
                    <Tag color="magenta">{guidanceResult.zone}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="车位类型">
                    <Tag color="cyan">
                      {spaceTypeLabels[guidanceResult.space.type]}
                      {guidanceResult.typePreference && <span>（已按偏好推荐）</span>}
                    </Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="距离电梯">
                    <span style={{ fontWeight: 600 }}>{guidanceResult.distance} 步</span>
                  </Descriptions.Item>
                  <Descriptions.Item label="路线">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>电梯</span>
                      <ArrowRightOutlined />
                      <span>共 {guidanceResult.path.length} 个格子</span>
                      <ArrowRightOutlined />
                      <span>车位</span>
                    </div>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            }
          />
          <Space style={{ width: '100%', justifyContent: 'center' }}>
            <Button
              onClick={handleRecommendSpace}
              icon={<HistoryOutlined />}
              loading={guidanceLoading}
            >
              重新推荐
            </Button>
            <Button
              type="primary"
              size="large"
              onClick={handleConfirmEntry}
              icon={<CheckCircleOutlined />}
              loading={guidanceLoading}
            >
              确认入场
            </Button>
          </Space>
        </div>
      );
    }

    if (entryStep === 2 && entryResult) {
      return (
        <div>
          <Result
            status="success"
            title="车辆入场成功！"
            subTitle={
              <div>
                <p style={{ fontSize: 16, marginBottom: 16 }}>
                  车牌号：<span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600, fontSize: 18 }}>{entryResult.record.plateNo}</span>
                </p>
                <p>请前往 <Tag color="magenta">{entryResult.guidance.zone}</Tag> <Tag color="blue">{entryResult.guidance.spaceNo}</Tag> 车位停车</p>
                {entryResult.member && (
                  <Alert
                    message={`欢迎回来，${entryResult.member.name}！您是尊贵的会员，本次停车免费。`}
                    type="success"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            }
            extra={[
              <Button type="primary" key="close" onClick={resetGuidance}>
                完成
              </Button>
            ]}
          />
        </div>
      );
    }

    return null;
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
              <Radio.Button value={1} onClick={() => { setCurrentFloor(1); clearHighlight(); }}>1层</Radio.Button>
              <Radio.Button value={2} onClick={() => { setCurrentFloor(2); clearHighlight(); }}>2层</Radio.Button>
              <Radio.Button value={3} onClick={() => { setCurrentFloor(3); clearHighlight(); }}>3层</Radio.Button>
            </Radio.Group>
          </Space>
        }
        extra={
          <Space>
            <span>类型筛选:</span>
            <Select
              value={filterType}
              onChange={(value) => { setFilterType(value); clearHighlight(); }}
              style={{ width: 120 }}
            >
              <Option value="all">全部</Option>
              <Option value="normal">普通</Option>
              <Option value="disabled">残疾人</Option>
              <Option value="vip">VIP</Option>
              <Option value="charging">充电桩</Option>
            </Select>
            {highlightPath.size > 0 && (
              <Button size="small" onClick={clearHighlight}>
                清除高亮
              </Button>
            )}
            <Button
              type="primary"
              icon={<ThunderboltOutlined />}
              onClick={() => setGuidanceModalVisible(true)}
            >
              智能入场引导
            </Button>
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
          <div className="legend-item">
            <div className="legend-color" style={{ background: '#9254de' }}></div>
            <span>🛤️ 推荐路径</span>
          </div>
          <div className="legend-item">
            <div className="legend-color" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}></div>
            <span>⭐ 推荐车位</span>
          </div>
        </div>

        <div
          className="space-grid"
          style={{
            ...gridStyle,
            justifyItems: 'center',
            alignItems: 'center',
            position: 'relative'
          }}
        >
          {filteredSpaces.map(space => {
            const isPath = isPathCell(space.row, space.col);
            const isRecommended = isRecommendedSpace(space.id);
            return (
              <div
                key={space.id}
                className={getSpaceClass(space)}
                style={{
                  ...getSpaceItemStyle(space),
                  position: 'relative',
                  boxShadow: isRecommended ? '0 0 20px rgba(102, 126, 234, 0.6)' :
                             isPath ? '0 0 15px rgba(146, 84, 222, 0.5)' : 'none',
                  zIndex: isRecommended ? 10 : isPath ? 5 : 1
                }}
                onClick={() => handleSpaceClick(space)}
              >
                {space.spaceNo.split('-')[1]}
                {isRecommended && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -8,
                      right: -8,
                      background: '#faad14',
                      color: '#fff',
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 10,
                      fontWeight: 600
                    }}
                  >
                    推荐
                  </div>
                )}
              </div>
            );
          })}

          {Array.from(highlightPath).map(key => {
            const [row, col] = key.split('-').map(Number);
            const hasSpace = filteredSpaces.some(s => s.row === row && s.col === col);
            if (hasSpace) return null;

            return (
              <div
                key={`path-${key}`}
                style={{
                  gridColumn: col + 1,
                  gridRow: row + 1,
                  width: '60px',
                  height: '30px',
                  background: 'rgba(146, 84, 222, 0.3)',
                  border: '2px dashed #9254de',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '12px',
                  color: '#9254de',
                  fontWeight: 600
                }}
              >
                →
              </div>
            );
          })}
        </div>
      </Card>

      <Modal
        title="车位详情"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          selectedSpace?.status === 'available' && (
            <Button
              key="guidance"
              type="primary"
              icon={<ArrowRightOutlined />}
              onClick={() => {
                handleShowPath(selectedSpace!);
                setModalVisible(false);
              }}
            >
              显示路线
            </Button>
          ),
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

      <Modal
        title={
          <Space>
            <ThunderboltOutlined style={{ color: '#1890ff' }} />
            <span>智能车位引导</span>
          </Space>
        }
        open={guidanceModalVisible}
        onCancel={resetGuidance}
        footer={null}
        width={600}
      >
        <Steps current={entryStep} style={{ marginBottom: 24 }}>
          <Step title="输入信息" />
          <Step title="获得推荐" />
          <Step title="完成入场" />
        </Steps>
        {renderGuidanceSteps()}
      </Modal>
    </div>
  );
};

export default ParkingMap;
