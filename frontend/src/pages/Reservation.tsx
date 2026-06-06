import { useState, useEffect } from 'react';
import {
  Tabs,
  Form,
  Input,
  Select,
  DatePicker,
  TimePicker,
  Button,
  Table,
  Modal,
  Tag,
  message,
  Descriptions,
  Card,
  Space,
  Typography,
  Alert
} from 'antd';
import {
  CalendarOutlined,
  PlusOutlined,
  SearchOutlined,
  CloseOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Dayjs } from 'dayjs';
import { reservationApi, spaceApi, configApi } from '../services/api';
import { formatDate, formatDateTime, reservationStatusMap, spaceTypeMap, isValidPlateNo } from '../utils';
import type { Reservation, ParkingSpace, ParkingConfig } from '../types';
import type { ColumnsType } from 'antd/es/table';

const { Title, Text } = Typography;

type TabKey = 'list' | 'create';

const statusColorMap: Record<string, string> = {
  pending: 'warning',
  active: 'processing',
  completed: 'success',
  cancelled: 'default',
  expired: 'error'
};

const statusOptions = [
  { value: '', label: '全部' },
  { value: 'pending', label: '待入场' },
  { value: 'active', label: '使用中' },
  { value: 'completed', label: '已完成' },
  { value: 'cancelled', label: '已取消' },
  { value: 'expired', label: '已过期' }
];

const Reservation = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [form] = Form.useForm();

  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState({ plateNo: '', status: '' });

  const [availableSpaces, setAvailableSpaces] = useState<ParkingSpace[]>([]);
  const [spacesLoading, setSpacesLoading] = useState(false);
  const [config, setConfig] = useState<ParkingConfig | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [cancelModalVisible, setCancelModalVisible] = useState(false);
  const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailData, setDetailData] = useState<Reservation | null>(null);

  const fetchReservations = async (page = 1, pageSize = 10, filter = { plateNo: '', status: '' }) => {
    setLoading(true);
    try {
      const res = await reservationApi.getList({
        plateNo: filter.plateNo || undefined,
        status: filter.status || undefined,
        page,
        pageSize
      });
      if (res.success) {
        setReservations(res.data?.reservations || []);
        setTotal(res.data?.total || 0);
        setPage(page);
        setPageSize(pageSize);
      }
    } catch (error) {
      console.error('Failed to fetch reservations:', error);
      message.error('获取预约列表失败');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableSpaces = async () => {
    setSpacesLoading(true);
    try {
      const res = await spaceApi.getAvailableSpaces();
      if (res.success) {
        setAvailableSpaces(res.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch available spaces:', error);
      message.error('获取可用车位失败');
    } finally {
      setSpacesLoading(false);
    }
  };

  const fetchConfig = async () => {
    try {
      const res = await configApi.getConfig();
      if (res.success) {
        setConfig(res.data || null);
      }
    } catch (error) {
      console.error('Failed to fetch config:', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchReservations(page, pageSize, filter);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'create') {
      fetchAvailableSpaces();
      fetchConfig();
    }
  }, [activeTab]);

  const handleSearch = () => {
    fetchReservations(1, pageSize, filter);
  };

  const handleReset = () => {
    setFilter({ plateNo: '', status: '' });
    fetchReservations(1, pageSize, { plateNo: '', status: '' });
  };

  const handleCancelClick = (record: Reservation) => {
    setCancelTarget(record);
    setCancelModalVisible(true);
  };

  const handleConfirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    try {
      const res = await reservationApi.cancel(cancelTarget.id);
      if (res.success) {
        message.success('取消预约成功');
        setCancelModalVisible(false);
        setCancelTarget(null);
        fetchReservations(page, pageSize, filter);
      } else {
        message.error(res.message || '取消预约失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '取消预约失败');
    } finally {
      setCancelLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      const plateNo = values.plateNo.toUpperCase();
      if (!isValidPlateNo(plateNo)) {
        message.error('车牌号格式不正确');
        return;
      }

      const reserveDate = values.reserveDate.format('YYYY-MM-DD');
      const startTime = values.startTime.format('HH:mm');
      const endTime = values.endTime.format('HH:mm');

      if (values.startTime.isAfter(values.endTime)) {
        message.error('开始时间不能晚于结束时间');
        return;
      }

      setSubmitting(true);
      const res = await reservationApi.create({
        plateNo,
        spaceId: values.spaceId,
        reserveDate,
        startTime,
        endTime
      });
      if (res.success) {
        message.success('预约成功');
        setDetailData(res.data?.reservation || null);
        setDetailModalVisible(true);
        form.resetFields();
      } else {
        message.error(res.message || '预约失败');
      }
    } catch (error: any) {
      if (error.errorFields) {
        return;
      }
      message.error(error.response?.data?.message || '预约失败');
    } finally {
      setSubmitting(false);
    }
  };

  const handleTabChange = (key: string) => {
    setActiveTab(key as TabKey);
    if (key === 'create') {
      form.resetFields();
    }
  };

  const disabledDate = (current: Dayjs) => {
    return current && current < dayjs().startOf('day');
  };

  const columns: ColumnsType<Reservation> = [
    {
      title: '预约单号',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      render: (id) => `#${id.toString().padStart(6, '0')}`
    },
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
      title: '预约日期',
      dataIndex: 'reserveDate',
      key: 'reserveDate',
      width: 120,
      render: (date) => formatDate(date)
    },
    {
      title: '时间段',
      key: 'timeRange',
      width: 140,
      render: (_, record) => `${record.startTime} - ${record.endTime}`
    },
    {
      title: '预付费用',
      dataIndex: 'prepaidFee',
      key: 'prepaidFee',
      width: 100,
      render: (fee) => `¥${fee.toFixed(2)}`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => (
        <Tag color={statusColorMap[status] || 'default'}>
          {reservationStatusMap[status] || status}
        </Tag>
      )
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space>
          {record.status === 'pending' && (
            <Button
              type="link"
              danger
              size="small"
              icon={<CloseOutlined />}
              onClick={() => handleCancelClick(record)}
            >
              取消
            </Button>
          )}
        </Space>
      )
    }
  ];

  const renderListTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="输入车牌号搜索"
            value={filter.plateNo}
            onChange={(e) => setFilter({ ...filter, plateNo: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="状态筛选"
            value={filter.status || undefined}
            onChange={(value) => setFilter({ ...filter, status: value || '' })}
            style={{ width: 150 }}
            allowClear
            options={statusOptions}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={reservations}
        rowKey="id"
        loading={loading}
        scroll={{ x: 950 }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total) => `共 ${total} 条记录`,
          onChange: (page, pageSize) => fetchReservations(page, pageSize, filter)
        }}
      />

      <Modal
        title="确认取消预约"
        open={cancelModalVisible}
        onOk={handleConfirmCancel}
        onCancel={() => {
          setCancelModalVisible(false);
          setCancelTarget(null);
        }}
        confirmLoading={cancelLoading}
        okText="确认取消"
        cancelText="返回"
        okButtonProps={{ danger: true }}
      >
        {cancelTarget && (
          <Space direction="vertical" style={{ width: '100%' }}>
            <p>确定要取消以下预约吗？</p>
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="预约单号">#{cancelTarget.id.toString().padStart(6, '0')}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{cancelTarget.plateNo}</Descriptions.Item>
              <Descriptions.Item label="车位号">{cancelTarget.spaceNo}</Descriptions.Item>
              <Descriptions.Item label="预约日期">{formatDate(cancelTarget.reserveDate)}</Descriptions.Item>
              <Descriptions.Item label="时间段">{cancelTarget.startTime} - {cancelTarget.endTime}</Descriptions.Item>
            </Descriptions>
            <Text type="warning">
              <InfoCircleOutlined /> 取消预约后，预付费用将不予退还
            </Text>
          </Space>
        )}
      </Modal>
    </div>
  );

  const renderCreateTab = () => (
    <div style={{ maxWidth: 600, margin: '0 auto' }}>
      <Card title="新建预约">
        <Alert
          message="预约费用说明"
          description="预付1小时停车费，入场后可抵扣"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form form={form} layout="vertical">
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
            <Input
              placeholder="请输入车牌号，如：京A12345"
              style={{ textTransform: 'uppercase' }}
              maxLength={8}
            />
          </Form.Item>

          <Form.Item
            name="spaceId"
            label="选择车位"
            rules={[{ required: true, message: '请选择车位' }]}
          >
            <Select
              placeholder="请选择车位"
              loading={spacesLoading}
              options={availableSpaces.map(space => ({
                value: space.id,
                label: `${space.spaceNo} - ${spaceTypeMap[space.type]} - B${space.floor}层`
              }))}
            />
          </Form.Item>

          <Form.Item
            name="reserveDate"
            label="预约日期"
            rules={[{ required: true, message: '请选择预约日期' }]}
          >
            <DatePicker
              style={{ width: '100%' }}
              disabledDate={disabledDate}
              placeholder="选择日期"
            />
          </Form.Item>

          <Space wrap style={{ width: '100%' }}>
            <Form.Item
              name="startTime"
              label="开始时间"
              rules={[{ required: true, message: '请选择开始时间' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder="选择开始时间"
              />
            </Form.Item>

            <Form.Item
              name="endTime"
              label="结束时间"
              rules={[{ required: true, message: '请选择结束时间' }]}
              style={{ flex: 1, marginBottom: 0 }}
            >
              <TimePicker
                style={{ width: '100%' }}
                format="HH:mm"
                placeholder="选择结束时间"
              />
            </Form.Item>
          </Space>

          {config && (
            <Card size="small" style={{ marginTop: 24, background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Space align="baseline">
                <Text>预约费用：</Text>
                <Title level={4} style={{ margin: 0, color: '#52c41a' }}>
                  ¥{config.reservationFee.toFixed(2)}
                </Title>
                <Text type="secondary">(预付1小时)</Text>
              </Space>
            </Card>
          )}

          <Form.Item style={{ marginTop: 24 }}>
            <Button
              type="primary"
              size="large"
              icon={<PlusOutlined />}
              onClick={handleSubmit}
              loading={submitting}
              block
            >
              提交预约
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Modal
        title="预约成功"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setDetailData(null);
          setActiveTab('list');
        }}
        footer={[
          <Button
            key="view"
            type="primary"
            onClick={() => {
              setDetailModalVisible(false);
              setDetailData(null);
              setActiveTab('list');
            }}
          >
            查看我的预约
          </Button>
        ]}
        width={500}
      >
        {detailData && (
          <div>
            <Alert
              message="预约成功！请按时入场"
              type="success"
              showIcon
              style={{ marginBottom: 16 }}
            />
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="预约单号">
                #{detailData.id.toString().padStart(6, '0')}
              </Descriptions.Item>
              <Descriptions.Item label="车牌号">
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{detailData.plateNo}</span>
              </Descriptions.Item>
              <Descriptions.Item label="车位号">{detailData.spaceNo}</Descriptions.Item>
              <Descriptions.Item label="预约日期">{formatDate(detailData.reserveDate)}</Descriptions.Item>
              <Descriptions.Item label="时间段">
                {detailData.startTime} - {detailData.endTime}
              </Descriptions.Item>
              <Descriptions.Item label="预付费用">
                <span style={{ color: '#52c41a', fontWeight: 'bold' }}>
                  ¥{detailData.prepaidFee.toFixed(2)}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="创建时间">
                {formatDateTime(detailData.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColorMap[detailData.status] || 'default'}>
                  {reservationStatusMap[detailData.status] || detailData.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Modal>
    </div>
  );

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <CalendarOutlined /> 我的预约
        </span>
      ),
      children: renderListTab()
    },
    {
      key: 'create',
      label: (
        <span>
          <PlusOutlined /> 新建预约
        </span>
      ),
      children: renderCreateTab()
    }
  ];

  return (
    <div>
      <Tabs
        activeKey={activeTab}
        onChange={handleTabChange}
        items={tabItems}
        size="large"
      />
    </div>
  );
};

export default Reservation;
