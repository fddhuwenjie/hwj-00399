import { useState, useEffect } from 'react';
import {
  Tabs,
  Form,
  Input,
  Button,
  Table,
  Modal,
  Descriptions,
  Tag,
  message,
  Spin,
  Space,
  Radio,
  Select,
  Card,
  Row,
  Col
} from 'antd';
import {
  CarTwoTone,
  HistoryOutlined,
  SearchOutlined,
  CameraOutlined,
  EditOutlined,
  CheckCircleOutlined,
  ReloadOutlined,
  LoginOutlined,
  LogoutOutlined
} from '@ant-design/icons';
import { recordApi, spaceApi } from '../services/api';
import { formatDuration, formatDateTime, formatDate, generatePlateNo, isValidPlateNo, memberTypeMap, paymentTypeMap, recordStatusMap } from '../utils';
import type { ParkingRecord, Member, ParkingSpace } from '../types';
import type { ColumnsType } from 'antd/es/table';

type TabKey = 'entry' | 'exit' | 'parking' | 'history';

interface FeeDetail {
  entryTime: string;
  duration: number;
  originalFee: number;
  discount: number;
  actualFee: number;
  member?: Member;
}

const VehicleManagement = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('entry');
  const [form] = Form.useForm();
  const [manualForm] = Form.useForm();
  const [exitForm] = Form.useForm();

  const [scanning, setScanning] = useState(false);
  const [recognizedPlate, setRecognizedPlate] = useState('');
  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [entryMember, setEntryMember] = useState<Member | null>(null);
  const [assignedSpace, setAssignedSpace] = useState<ParkingSpace | null>(null);
  const [entryLoading, setEntryLoading] = useState(false);

  const [feeDetail, setFeeDetail] = useState<FeeDetail | null>(null);
  const [exitLoading, setExitLoading] = useState(false);
  const [calculatingFee, setCalculatingFee] = useState(false);
  const [paymentType, setPaymentType] = useState<string>('wechat');

  const [parkingCars, setParkingCars] = useState<ParkingRecord[]>([]);
  const [parkingLoading, setParkingLoading] = useState(false);
  const [parkingSearchText, setParkingSearchText] = useState('');

  const [historyRecords, setHistoryRecords] = useState<ParkingRecord[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyFilter, setHistoryFilter] = useState({ plateNo: '', status: '' });

  const [exitModalVisible, setExitModalVisible] = useState(false);
  const [exitModalRecord, setExitModalRecord] = useState<ParkingRecord | null>(null);
  const [exitModalFeeDetail, setExitModalFeeDetail] = useState<FeeDetail | null>(null);
  const [exitModalLoading, setExitModalLoading] = useState(false);

  const generateRandomPlate = () => {
    setScanning(true);
    setRecognizedPlate('');
    setEntryMember(null);
    setAssignedSpace(null);

    setTimeout(() => {
      const plate = generatePlateNo();
      setRecognizedPlate(plate);
      setScanning(false);
    }, 2000);
  };

  const handleManualEntry = async () => {
    try {
      const values = await manualForm.validateFields();
      const plate = values.plateNo.toUpperCase();
      if (!isValidPlateNo(plate)) {
        message.error('车牌号格式不正确');
        return;
      }
      setRecognizedPlate(plate);
      setManualModalVisible(false);
      manualForm.resetFields();
    } catch (error) {
      console.error('Validation failed:', error);
    }
  };

  const fetchAvailableSpace = async () => {
    try {
      const res = await spaceApi.getAvailableSpaces();
      if (res.success && res.data && res.data.length > 0) {
        setAssignedSpace(res.data[0]);
      } else {
        message.warning('暂无可用车位');
      }
    } catch (error) {
      console.error('Failed to fetch available space:', error);
    }
  };

  useEffect(() => {
    if (recognizedPlate) {
      fetchAvailableSpace();
    }
  }, [recognizedPlate]);

  const handleConfirmEntry = async () => {
    if (!recognizedPlate) {
      message.warning('请先识别车牌号');
      return;
    }
    if (!assignedSpace) {
      message.warning('暂无可用车位，无法入场');
      return;
    }

    setEntryLoading(true);
    try {
      const res = await recordApi.entryVehicle({
        plateNo: recognizedPlate,
        spaceId: assignedSpace.id,
        manual: false
      });
      if (res.success) {
        message.success('车辆入场成功');
        if (res.data?.member) {
          setEntryMember(res.data.member);
        }
        setRecognizedPlate('');
        setAssignedSpace(null);
        setEntryMember(null);
        form.resetFields();
      } else {
        message.error(res.message || '入场失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '入场失败');
    } finally {
      setEntryLoading(false);
    }
  };

  const handleCalculateFee = async () => {
    try {
      const values = await exitForm.validateFields();
      setCalculatingFee(true);
      const res = await recordApi.calculateFee({ plateNo: values.plateNo.toUpperCase() });
      if (res.success) {
        setFeeDetail(res.data?.feeDetail);
      } else {
        message.error(res.message || '查询失败');
        setFeeDetail(null);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '查询失败');
      setFeeDetail(null);
    } finally {
      setCalculatingFee(false);
    }
  };

  const handleConfirmExit = async () => {
    if (!feeDetail) {
      message.warning('请先查询停车记录');
      return;
    }

    setExitLoading(true);
    try {
      const values = await exitForm.validateFields();
      const res = await recordApi.exitVehicle({
        plateNo: values.plateNo.toUpperCase(),
        paymentType
      });
      if (res.success) {
        message.success('车辆出场成功');
        setFeeDetail(null);
        exitForm.resetFields();
        setPaymentType('wechat');
      } else {
        message.error(res.message || '出场失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '出场失败');
    } finally {
      setExitLoading(false);
    }
  };

  const fetchParkingCars = async (plateNo?: string) => {
    setParkingLoading(true);
    try {
      const res = await recordApi.getParkingCars(plateNo);
      if (res.success) {
        setParkingCars(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch parking cars:', error);
    } finally {
      setParkingLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'parking') {
      fetchParkingCars(parkingSearchText);
    }
  }, [activeTab]);

  const handleParkingSearch = () => {
    fetchParkingCars(parkingSearchText);
  };

  const handleQuickExit = async (record: ParkingRecord) => {
    setExitModalRecord(record);
    setExitModalVisible(true);
    setExitModalFeeDetail(null);

    try {
      const res = await recordApi.calculateFee({ plateNo: record.plateNo });
      if (res.success) {
        setExitModalFeeDetail(res.data?.feeDetail);
      }
    } catch (error) {
      console.error('Failed to calculate fee:', error);
    }
  };

  const handleModalConfirmExit = async () => {
    if (!exitModalRecord || !exitModalFeeDetail) return;

    setExitModalLoading(true);
    try {
      const res = await recordApi.exitVehicle({
        plateNo: exitModalRecord.plateNo,
        paymentType
      });
      if (res.success) {
        message.success('车辆出场成功');
        setExitModalVisible(false);
        setExitModalRecord(null);
        setExitModalFeeDetail(null);
        fetchParkingCars(parkingSearchText);
      } else {
        message.error(res.message || '出场失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '出场失败');
    } finally {
      setExitModalLoading(false);
    }
  };

  const fetchHistoryRecords = async (page = 1, pageSize = 10, filter = { plateNo: '', status: '' }) => {
    setHistoryLoading(true);
    try {
      const res = await recordApi.getRecords({
        plateNo: filter.plateNo || undefined,
        status: filter.status || undefined,
        page,
        pageSize
      });
      if (res.success) {
        setHistoryRecords(res.data?.records || []);
        setHistoryTotal(res.data?.total || 0);
        setHistoryPage(page);
        setHistoryPageSize(pageSize);
      }
    } catch (error) {
      console.error('Failed to fetch history records:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'history') {
      fetchHistoryRecords(historyPage, historyPageSize, historyFilter);
    }
  }, [activeTab]);

  const handleHistorySearch = () => {
    fetchHistoryRecords(1, historyPageSize, historyFilter);
  };

  const handleHistoryReset = () => {
    setHistoryFilter({ plateNo: '', status: '' });
    fetchHistoryRecords(1, historyPageSize, { plateNo: '', status: '' });
  };

  const parkingColumns: ColumnsType<ParkingRecord> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{text}</span>
    },
    {
      title: '车位号',
      dataIndex: 'spaceNo',
      key: 'spaceNo',
      width: 100
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
      width: 80,
      render: (floor) => `B${floor}层`
    },
    {
      title: '入场时间',
      dataIndex: 'entryTime',
      key: 'entryTime',
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '停车时长',
      key: 'duration',
      width: 120,
      render: (_, record) => {
        const minutes = Math.floor((Date.now() - new Date(record.entryTime).getTime()) / 60000);
        return formatDuration(minutes);
      }
    },
    {
      title: '是否会员',
      dataIndex: 'memberId',
      key: 'member',
      width: 100,
      render: (memberId) => (memberId ? <Tag color="purple">会员</Tag> : <Tag>普通</Tag>)
    },
    {
      title: '操作',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button type="primary" size="small" onClick={() => handleQuickExit(record)}>
          出场
        </Button>
      )
    }
  ];

  const historyColumns: ColumnsType<ParkingRecord> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text) => <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{text}</span>
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
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '出场时间',
      dataIndex: 'exitTime',
      key: 'exitTime',
      width: 160,
      render: (time) => formatDateTime(time)
    },
    {
      title: '停车时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (duration) => (duration ? formatDuration(duration) : '-')
    },
    {
      title: '费用',
      dataIndex: 'fee',
      key: 'fee',
      width: 100,
      render: (fee) => (fee !== null ? `¥${fee.toFixed(2)}` : '-')
    },
    {
      title: '支付方式',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 100,
      render: (type) => (type ? paymentTypeMap[type as keyof typeof paymentTypeMap] || type : '-')
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap: Record<string, string> = {
          parking: 'processing',
          completed: 'success',
          reserved: 'warning'
        };
        return <Tag color={colorMap[status] || 'default'}>{recordStatusMap[status] || status}</Tag>;
      }
    }
  ];

  const renderEntryTab = () => (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center' }}>
            <Button
              type="primary"
              size="large"
              icon={<CameraOutlined />}
              onClick={generateRandomPlate}
              loading={scanning}
              style={{ marginBottom: 16 }}
            >
              模拟车牌识别
            </Button>
          </div>

          <div className={`plate-display ${scanning ? 'camera-animation' : ''}`}>
            {scanning ? <Spin size="large" tip="识别中..." /> : recognizedPlate || '请点击上方按钮识别车牌'}
          </div>

          <div style={{ textAlign: 'center' }}>
            <Button type="link" icon={<EditOutlined />} onClick={() => setManualModalVisible(true)}>
              识别失败？手动录入
            </Button>
          </div>

          {entryMember && (
            <Descriptions title="会员信息" bordered size="small" column={1}>
              <Descriptions.Item label="会员姓名">{entryMember.name}</Descriptions.Item>
              <Descriptions.Item label="会员类型">
                <Tag color="purple">{memberTypeMap[entryMember.memberType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="会员折扣">
                <Tag color="green">{(entryMember.discount * 10).toFixed(1)}折</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="有效期">
                {formatDate(entryMember.startDate)} ~ {formatDate(entryMember.endDate)}
              </Descriptions.Item>
            </Descriptions>
          )}

          {assignedSpace && (
            <Card size="small" title="分配车位" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Row align="middle" gutter={16}>
                <Col>
                  <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 24 }} />
                </Col>
                <Col>
                  <div style={{ fontSize: 16, fontWeight: 'bold' }}>{assignedSpace.spaceNo}</div>
                  <div style={{ color: '#666', fontSize: 12 }}>B{assignedSpace.floor}层</div>
                </Col>
              </Row>
            </Card>
          )}

          <Button
            type="primary"
            size="large"
            icon={<LoginOutlined />}
            onClick={handleConfirmEntry}
            loading={entryLoading}
            disabled={!recognizedPlate || !assignedSpace}
            block
          >
            确认入场
          </Button>
        </Space>
      </Card>

      <Modal
        title="手动录入车牌号"
        open={manualModalVisible}
        onOk={handleManualEntry}
        onCancel={() => {
          setManualModalVisible(false);
          manualForm.resetFields();
        }}
        okText="确认"
        cancelText="取消"
      >
        <Form form={manualForm} layout="vertical">
          <Form.Item
            name="plateNo"
            label="车牌号"
            rules={[
              { required: true, message: '请输入车牌号' },
              {
                validator: (_, value) => {
                  if (!value) return Promise.resolve();
                  if (isValidPlateNo(value.toUpperCase())) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('车牌号格式不正确'));
                }
              }
            ]}
          >
            <Input placeholder="请输入车牌号，如：京A12345" style={{ textTransform: 'uppercase' }} maxLength={8} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );

  const renderExitTab = () => (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card title="出场结算">
        <Form form={exitForm} layout="vertical">
          <Form.Item
            name="plateNo"
            label="车牌号"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input placeholder="请输入车牌号查询" allowClear style={{ textTransform: 'uppercase' }} />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleCalculateFee}
                loading={calculatingFee}
              >
                查询费用
              </Button>
            </Space>
          </Form.Item>
        </Form>

        {feeDetail && (
          <div className="fee-detail">
            <Descriptions title="费用明细" column={1} size="small">
              <Descriptions.Item label="入场时间">{formatDateTime(feeDetail.entryTime)}</Descriptions.Item>
              <Descriptions.Item label="停车时长">{formatDuration(feeDetail.duration)}</Descriptions.Item>
              <Descriptions.Item label="原价">¥{feeDetail.originalFee.toFixed(2)}</Descriptions.Item>
              {feeDetail.member && (
                <Descriptions.Item label="会员折扣">
                  <Tag color="purple">
                    {memberTypeMap[feeDetail.member.memberType]} {(feeDetail.discount * 10).toFixed(1)}折
                  </Tag>
                </Descriptions.Item>
              )}
              <Descriptions.Item label="实付金额">
                <span className="fee-total">¥{feeDetail.actualFee.toFixed(2)}</span>
              </Descriptions.Item>
            </Descriptions>

            <div style={{ marginTop: 16 }}>
              <div style={{ marginBottom: 8 }}>支付方式：</div>
              <Radio.Group value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <Radio value="wechat">微信支付</Radio>
                <Radio value="alipay">支付宝</Radio>
                <Radio value="cash">现金</Radio>
                <Radio value="card">会员卡</Radio>
              </Radio.Group>
            </div>

            <Button
              type="primary"
              size="large"
              icon={<LogoutOutlined />}
              onClick={handleConfirmExit}
              loading={exitLoading}
              block
              style={{ marginTop: 16 }}
            >
              确认出场
            </Button>
          </div>
        )}
      </Card>
    </div>
  );

  const renderParkingTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space>
          <Input
            placeholder="输入车牌号模糊搜索"
            value={parkingSearchText}
            onChange={(e) => setParkingSearchText(e.target.value)}
            style={{ width: 250 }}
            allowClear
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleParkingSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={() => {
            setParkingSearchText('');
            fetchParkingCars('');
          }}>
            刷新
          </Button>
        </Space>
      </Card>

      <Table
        columns={parkingColumns}
        dataSource={parkingCars}
        rowKey="id"
        loading={parkingLoading}
        pagination={false}
        scroll={{ x: 900 }}
      />

      <Modal
        title="快速出场结算"
        open={exitModalVisible}
        onOk={handleModalConfirmExit}
        onCancel={() => {
          setExitModalVisible(false);
          setExitModalRecord(null);
          setExitModalFeeDetail(null);
        }}
        confirmLoading={exitModalLoading}
        okText="确认出场"
        cancelText="取消"
        width={500}
      >
        {exitModalRecord && (
          <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
            <Descriptions.Item label="车牌号">{exitModalRecord.plateNo}</Descriptions.Item>
            <Descriptions.Item label="车位号">{exitModalRecord.spaceNo}</Descriptions.Item>
            <Descriptions.Item label="入场时间">{formatDateTime(exitModalRecord.entryTime)}</Descriptions.Item>
          </Descriptions>
        )}

        {exitModalFeeDetail ? (
          <div className="fee-detail">
            <div className="fee-row">
              <span>停车时长</span>
              <span>{formatDuration(exitModalFeeDetail.duration)}</span>
            </div>
            <div className="fee-row">
              <span>原价</span>
              <span>¥{exitModalFeeDetail.originalFee.toFixed(2)}</span>
            </div>
            {exitModalFeeDetail.member && (
              <div className="fee-row">
                <span>会员折扣</span>
                <span style={{ color: '#722ed1' }}>
                  {memberTypeMap[exitModalFeeDetail.member.memberType]} {(exitModalFeeDetail.discount * 10).toFixed(1)}折
                </span>
              </div>
            )}
            <div className="fee-row">
              <span>实付金额</span>
              <span className="fee-total">¥{exitModalFeeDetail.actualFee.toFixed(2)}</span>
            </div>

            <div style={{ marginTop: 12 }}>
              <div style={{ marginBottom: 8 }}>支付方式：</div>
              <Radio.Group value={paymentType} onChange={(e) => setPaymentType(e.target.value)}>
                <Radio value="wechat">微信</Radio>
                <Radio value="alipay">支付宝</Radio>
                <Radio value="cash">现金</Radio>
                <Radio value="card">会员卡</Radio>
              </Radio.Group>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <Spin tip="计算费用中..." />
          </div>
        )}
      </Modal>
    </div>
  );

  const renderHistoryTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="车牌号"
            value={historyFilter.plateNo}
            onChange={(e) => setHistoryFilter({ ...historyFilter, plateNo: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态"
            value={historyFilter.status || undefined}
            onChange={(value) => setHistoryFilter({ ...historyFilter, status: value || '' })}
            style={{ width: 150 }}
            allowClear
          >
            <Select.Option value="">全部</Select.Option>
            <Select.Option value="parking">停车中</Select.Option>
            <Select.Option value="completed">已完成</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleHistorySearch}>
            搜索
          </Button>
          <Button onClick={handleHistoryReset}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={historyColumns}
        dataSource={historyRecords}
        rowKey="id"
        loading={historyLoading}
        scroll={{ x: 1100 }}
        pagination={{
          current: historyPage,
          pageSize: historyPageSize,
          total: historyTotal,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => fetchHistoryRecords(page, pageSize, historyFilter)
        }}
      />
    </div>
  );

  const tabItems = [
    {
      key: 'entry',
      label: (
        <span>
          <LoginOutlined /> 入场管理
        </span>
      ),
      children: renderEntryTab()
    },
    {
      key: 'exit',
      label: (
        <span>
          <LogoutOutlined /> 出场结算
        </span>
      ),
      children: renderExitTab()
    },
    {
      key: 'parking',
      label: (
        <span>
          <CarTwoTone /> 在场车辆
        </span>
      ),
      children: renderParkingTab()
    },
    {
      key: 'history',
      label: (
        <span>
          <HistoryOutlined /> 历史记录
        </span>
      ),
      children: renderHistoryTab()
    }
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as TabKey)}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

export default VehicleManagement;
