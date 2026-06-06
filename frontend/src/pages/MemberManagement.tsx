import { useState, useEffect } from 'react';
import {
  Tabs,
  Form,
  Input,
  Select,
  Radio,
  Button,
  Table,
  Modal,
  Tag,
  message,
  Descriptions,
  List,
  Card,
  Space,
  Row,
  Col,
  Divider,
  Statistic
} from 'antd';
import {
  UserOutlined,
  PlusOutlined,
  SearchOutlined,
  ReloadOutlined,
  EditOutlined,
  EyeOutlined,
  CreditCardOutlined,
  CalendarOutlined,
  CarOutlined,
  PhoneOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { memberApi } from '../services/api';
import { memberTypeMap, formatDate, formatDateTime, formatDuration, isValidPlateNo } from '../utils';
import type { Member, ParkingRecord, MemberType } from '../types';
import type { ColumnsType } from 'antd/es/table';

type TabKey = 'list' | 'create';

interface PriceItem {
  type: string;
  name: string;
  price: number;
  discount: number;
  days: number;
}

const MemberManagement = () => {
  const [activeTab, setActiveTab] = useState<TabKey>('list');
  const [form] = Form.useForm();

  const [members, setMembers] = useState<Member[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);

  const [priceList, setPriceList] = useState<PriceItem[]>([]);
  const [priceLoading, setPriceLoading] = useState(false);
  const [selectedType, setSelectedType] = useState<string>('monthly');
  const [createLoading, setCreateLoading] = useState(false);
  const [createResult, setCreateResult] = useState<{ member: Member; price: number } | null>(null);

  const [renewModalVisible, setRenewModalVisible] = useState(false);
  const [renewMember, setRenewMember] = useState<Member | null>(null);
  const [renewType, setRenewType] = useState<string>('');
  const [renewLoading, setRenewLoading] = useState(false);
  const [newEndDate, setNewEndDate] = useState<string>('');

  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailMember, setDetailMember] = useState<Member | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [parkingRecords, setParkingRecords] = useState<ParkingRecord[]>([]);

  const fetchMembers = async (pageNum = 1, size = 10, kw = '', status = '') => {
    setMembersLoading(true);
    try {
      const res = await memberApi.getList({
        keyword: kw || undefined,
        status: status || undefined,
        page: pageNum,
        pageSize: size
      });
      if (res.success) {
        setMembers(res.data?.members || []);
        setTotal(res.data?.total || 0);
        setPage(pageNum);
        setPageSize(size);
      }
    } catch (error) {
      console.error('Failed to fetch members:', error);
      message.error('获取会员列表失败');
    } finally {
      setMembersLoading(false);
    }
  };

  const fetchPriceList = async () => {
    setPriceLoading(true);
    try {
      const res = await memberApi.getPriceList();
      if (res.success) {
        setPriceList(res.data || []);
        if (res.data && res.data.length > 0) {
          setSelectedType(res.data[0].type);
        }
      }
    } catch (error) {
      console.error('Failed to fetch price list:', error);
    } finally {
      setPriceLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchMembers(page, pageSize, keyword, statusFilter);
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'create') {
      fetchPriceList();
      form.resetFields();
      setCreateResult(null);
    }
  }, [activeTab]);

  useEffect(() => {
    if (renewMember && renewType) {
      const currentEnd = dayjs(renewMember.endDate);
      const now = dayjs();
      const baseDate = currentEnd.isAfter(now) ? currentEnd : now;
      const priceItem = priceList.find(p => p.type === renewType);
      const days = priceItem?.days || 30;
      setNewEndDate(baseDate.add(days, 'day').format('YYYY-MM-DD'));
    }
  }, [renewMember, renewType, priceList]);

  const handleSearch = () => {
    fetchMembers(1, pageSize, keyword, statusFilter);
  };

  const handleReset = () => {
    setKeyword('');
    setStatusFilter('');
    fetchMembers(1, pageSize, '', '');
  };

  const handleStatusChange = (value: string) => {
    setStatusFilter(value);
    fetchMembers(1, pageSize, keyword, value);
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      const plateNo = values.plateNo.toUpperCase();
      if (!isValidPlateNo(plateNo)) {
        message.error('车牌号格式不正确');
        return;
      }

      setCreateLoading(true);
      const res = await memberApi.create({
        name: values.name,
        phone: values.phone,
        plateNo,
        memberType: selectedType
      });

      if (res.success) {
        message.success('会员开通成功');
        setCreateResult(res.data!);
      } else {
        message.error(res.message || '开通失败');
      }
    } catch (error: any) {
      if (error.response?.data?.message) {
        message.error(error.response.data.message);
      }
    } finally {
      setCreateLoading(false);
    }
  };

  const handleOpenRenew = (member: Member) => {
    setRenewMember(member);
    setRenewType(member.memberType);
    setRenewModalVisible(true);
  };

  const handleRenew = async () => {
    if (!renewMember) return;

    setRenewLoading(true);
    try {
      const res = await memberApi.renew(renewMember.id, {
        memberType: renewType || undefined
      });
      if (res.success) {
        message.success('续费成功');
        setRenewModalVisible(false);
        setRenewMember(null);
        fetchMembers(page, pageSize, keyword, statusFilter);
      } else {
        message.error(res.message || '续费失败');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '续费失败');
    } finally {
      setRenewLoading(false);
    }
  };

  const handleOpenDetail = async (member: Member) => {
    setDetailModalVisible(true);
    setDetailLoading(true);
    setDetailMember(member);

    try {
      const res = await memberApi.getRecords(member.id, { page: 1, pageSize: 10 });
      if (res.success) {
        setParkingRecords(res.data?.records || []);
      }
    } catch (error) {
      console.error('Failed to fetch member records:', error);
    } finally {
      setDetailLoading(false);
    }
  };

  const memberColumns: ColumnsType<Member> = [
    {
      title: '会员ID',
      dataIndex: 'id',
      key: 'id',
      width: 80
    },
    {
      title: '姓名',
      dataIndex: 'name',
      key: 'name',
      width: 100,
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '电话',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (text) => (
        <Space>
          <PhoneOutlined />
          {text}
        </Space>
      )
    },
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text) => (
        <Space>
          <CarOutlined />
          <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{text}</span>
        </Space>
      )
    },
    {
      title: '会员类型',
      dataIndex: 'memberType',
      key: 'memberType',
      width: 100,
      render: (type) => (
        <Tag color="purple">{memberTypeMap[type as keyof typeof memberTypeMap]}</Tag>
      )
    },
    {
      title: '有效期',
      key: 'validity',
      width: 200,
      render: (_, record) => (
        <Space direction="vertical" size={0}>
          <span>{formatDate(record.startDate)}</span>
          <span style={{ color: '#999' }}>至</span>
          <span>{formatDate(record.endDate)}</span>
        </Space>
      )
    },
    {
      title: '剩余天数',
      key: 'daysRemaining',
      width: 110,
      render: (_, record) => {
        const days = record.daysRemaining ?? 0;
        if (days <= 7 && days > 0) {
          return (
            <div className="expiring-warning">
              <Tag color="red">
                <ClockCircleOutlined /> {days}天
              </Tag>
            </div>
          );
        }
        if (days <= 0) {
          return <Tag color="default">已过期</Tag>;
        }
        return <span>{days}天</span>;
      }
    },
    {
      title: '折扣',
      dataIndex: 'discount',
      key: 'discount',
      width: 80,
      render: (discount) => (
        <Tag color="green">{(discount * 10).toFixed(1)}折</Tag>
      )
    },
    {
      title: '停车次数',
      dataIndex: 'totalParkingCount',
      key: 'totalParkingCount',
      width: 100
    },
    {
      title: '累计时长',
      dataIndex: 'totalParkingHours',
      key: 'totalParkingHours',
      width: 110,
      render: (hours) => `${hours.toFixed(1)}小时`
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        const colorMap: Record<string, string> = {
          active: 'success',
          expired: 'default'
        };
        const textMap: Record<string, string> = {
          active: '有效',
          expired: '已过期'
        };
        return <Tag color={colorMap[status]}>{textMap[status]}</Tag>;
      }
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right',
      render: (_, record) => (
        <Space>
          <Button
            type="primary"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleOpenRenew(record)}
            disabled={record.status === 'expired'}
          >
            续费
          </Button>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleOpenDetail(record)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  const renderListTab = () => (
    <div>
      <Card size="small" style={{ marginBottom: 16 }}>
        <Space wrap>
          <Input
            placeholder="姓名/电话/车牌号"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            style={{ width: 250 }}
            allowClear
            prefix={<SearchOutlined />}
          />
          <Select
            placeholder="状态筛选"
            value={statusFilter || undefined}
            onChange={handleStatusChange}
            style={{ width: 150 }}
            allowClear
          >
            <Select.Option value="">全部</Select.Option>
            <Select.Option value="active">有效</Select.Option>
            <Select.Option value="expired">已过期</Select.Option>
          </Select>
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Table
        columns={memberColumns}
        dataSource={members}
        rowKey="id"
        loading={membersLoading}
        scroll={{ x: 1300 }}
        rowClassName={(record) => {
          if (record.isExpiringSoon) {
            return 'expiring-warning-row';
          }
          return '';
        }}
        pagination={{
          current: page,
          pageSize,
          total,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (t) => `共 ${t} 条记录`,
          onChange: (p, s) => fetchMembers(p, s, keyword, statusFilter)
        }}
      />
    </div>
  );

  const renderCreateTab = () => (
    <div>
      <Card
        title={
          <Space>
            <CreditCardOutlined />
            会员卡价目表
          </Space>
        }
        style={{ marginBottom: 16 }}
        loading={priceLoading}
      >
        <Row gutter={[16, 16]}>
          {priceList.map((item) => (
            <Col xs={24} sm={12} md={8} key={item.type}>
              <Card
                hoverable
                onClick={() => setSelectedType(item.type)}
                style={{
                  borderColor: selectedType === item.type ? '#722ed1' : '#d9d9d9',
                  borderWidth: selectedType === item.type ? 2 : 1,
                  background: selectedType === item.type ? '#f9f0ff' : '#fff'
                }}
              >
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 8 }}>
                    {item.name}
                  </div>
                  <div style={{ fontSize: 28, fontWeight: 'bold', color: '#722ed1', marginBottom: 8 }}>
                    ¥{item.price}
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <Tag color="green">{(item.discount * 10).toFixed(1)}折优惠</Tag>
                  </div>
                  <div style={{ color: '#666' }}>
                    <CalendarOutlined /> 有效期 {item.days} 天
                  </div>
                </div>
              </Card>
            </Col>
          ))}
        </Row>
      </Card>

      <Card
        title={
          <Space>
            <PlusOutlined />
            开通会员
          </Space>
        }
      >
        <Row gutter={32}>
          <Col xs={24} md={12}>
            <Form form={form} layout="vertical">
              <Form.Item
                name="name"
                label="姓名"
                rules={[
                  { required: true, message: '请输入姓名' },
                  { min: 2, max: 20, message: '姓名长度2-20个字符' }
                ]}
              >
                <Input placeholder="请输入姓名" prefix={<UserOutlined />} />
              </Form.Item>

              <Form.Item
                name="phone"
                label="手机号"
                rules={[
                  { required: true, message: '请输入手机号' },
                  { pattern: /^1[3-9]\d{9}$/, message: '请输入正确的手机号' }
                ]}
              >
                <Input placeholder="请输入手机号" prefix={<PhoneOutlined />} maxLength={11} />
              </Form.Item>

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
                  prefix={<CarOutlined />}
                  style={{ textTransform: 'uppercase' }}
                  maxLength={8}
                  allowClear
                />
              </Form.Item>

              <Form.Item label="会员类型">
                <Radio.Group value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                  {priceList.map((item) => (
                    <Radio.Button key={item.type} value={item.type}>
                      {item.name} ¥{item.price}
                    </Radio.Button>
                  ))}
                </Radio.Group>
              </Form.Item>

              <Form.Item>
                <Button
                  type="primary"
                  size="large"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                  loading={createLoading}
                  block
                >
                  立即开通
                </Button>
              </Form.Item>
            </Form>
          </Col>

          <Col xs={24} md={12}>
            {createResult ? (
              <div className="fee-detail">
                <Descriptions title="开通成功" column={1} size="small">
                  <Descriptions.Item label="会员姓名">{createResult.member.name}</Descriptions.Item>
                  <Descriptions.Item label="手机号">{createResult.member.phone}</Descriptions.Item>
                  <Descriptions.Item label="车牌号">{createResult.member.plateNo}</Descriptions.Item>
                  <Descriptions.Item label="会员类型">
                    <Tag color="purple">{memberTypeMap[createResult.member.memberType]}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="会员折扣">
                    <Tag color="green">{(createResult.member.discount * 10).toFixed(1)}折</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="有效期">
                    {formatDate(createResult.member.startDate)} ~ {formatDate(createResult.member.endDate)}
                  </Descriptions.Item>
                </Descriptions>
                <Divider />
                <div style={{ textAlign: 'center' }}>
                  <Statistic
                    title="应付金额"
                    value={createResult.price}
                    precision={2}
                    prefix="¥"
                    valueStyle={{ color: '#f5222d' }}
                  />
                </div>
              </div>
            ) : (
              <div style={{
                padding: '60px 20px',
                textAlign: 'center',
                background: '#fafafa',
                borderRadius: 8,
                border: '2px dashed #d9d9d9'
              }}>
                <CreditCardOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <div style={{ color: '#999' }}>填写左侧表单后提交开通</div>
              </div>
            )}
          </Col>
        </Row>
      </Card>
    </div>
  );

  const tabItems = [
    {
      key: 'list',
      label: (
        <span>
          <UserOutlined /> 会员列表
        </span>
      ),
      children: renderListTab()
    },
    {
      key: 'create',
      label: (
        <span>
          <PlusOutlined /> 开通会员
        </span>
      ),
      children: renderCreateTab()
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

      <Modal
        title="会员续费"
        open={renewModalVisible}
        onOk={handleRenew}
        onCancel={() => {
          setRenewModalVisible(false);
          setRenewMember(null);
        }}
        confirmLoading={renewLoading}
        okText="确认续费"
        cancelText="取消"
        width={500}
      >
        {renewMember && (
          <div>
            <Descriptions column={1} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="会员姓名">{renewMember.name}</Descriptions.Item>
              <Descriptions.Item label="车牌号">{renewMember.plateNo}</Descriptions.Item>
              <Descriptions.Item label="当前会员类型">
                <Tag color="purple">{memberTypeMap[renewMember.memberType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="当前到期日期">
                {formatDate(renewMember.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="剩余天数">
                {renewMember.daysRemaining && renewMember.daysRemaining > 0
                  ? `${renewMember.daysRemaining}天`
                  : '已过期'}
              </Descriptions.Item>
            </Descriptions>

            <Divider />

            <div style={{ marginBottom: 16 }}>
              <div style={{ marginBottom: 8 }}>选择续费类型：</div>
              <Radio.Group
                value={renewType}
                onChange={(e) => setRenewType(e.target.value)}
                style={{ width: '100%' }}
              >
                <Space direction="vertical" style={{ width: '100%' }}>
                  {priceList.map((item) => (
                    <Radio.Button
                      key={item.type}
                      value={item.type}
                      style={{
                        width: '100%',
                        height: 'auto',
                        padding: '12px 16px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span>
                        <Tag color="purple">{item.name}</Tag>
                        <span style={{ marginLeft: 8 }}>
                          <Tag color="green">{(item.discount * 10).toFixed(1)}折</Tag>
                        </span>
                      </span>
                      <span style={{ fontWeight: 'bold', color: '#722ed1' }}>¥{item.price}</span>
                    </Radio.Button>
                  ))}
                </Space>
              </Radio.Group>
            </div>

            <Card size="small" style={{ background: '#f6ffed', borderColor: '#b7eb8f' }}>
              <Row justify="space-between" align="middle">
                <Col>
                  <div style={{ color: '#666' }}>新到期日期</div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#52c41a' }}>
                    <CalendarOutlined /> {newEndDate}
                  </div>
                </Col>
                <Col>
                  {(() => {
                    const priceItem = priceList.find(p => p.type === renewType);
                    return (
                      <Statistic
                        value={priceItem?.price || 0}
                        precision={2}
                        prefix="¥"
                        valueStyle={{ color: '#f5222d', fontSize: 20 }}
                      />
                    );
                  })()}
                </Col>
              </Row>
            </Card>
          </div>
        )}
      </Modal>

      <Modal
        title="会员详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setDetailMember(null);
          setParkingRecords([]);
        }}
        footer={[
          <Button key="close" onClick={() => {
            setDetailModalVisible(false);
            setDetailMember(null);
            setParkingRecords([]);
          }}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {detailMember && (
          <div>
            <Descriptions title="基本信息" bordered column={2} size="small" style={{ marginBottom: 16 }}>
              <Descriptions.Item label="会员ID">{detailMember.id}</Descriptions.Item>
              <Descriptions.Item label="姓名">{detailMember.name}</Descriptions.Item>
              <Descriptions.Item label="手机号">{detailMember.phone}</Descriptions.Item>
              <Descriptions.Item label="车牌号">
                <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{detailMember.plateNo}</span>
              </Descriptions.Item>
              <Descriptions.Item label="会员类型">
                <Tag color="purple">{memberTypeMap[detailMember.memberType]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="折扣">
                <Tag color="green">{(detailMember.discount * 10).toFixed(1)}折</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="有效期">
                {formatDate(detailMember.startDate)} ~ {formatDate(detailMember.endDate)}
              </Descriptions.Item>
              <Descriptions.Item label="剩余天数">
                {detailMember.daysRemaining && detailMember.daysRemaining > 0 ? (
                  detailMember.daysRemaining <= 7 ? (
                    <Tag color="red">{detailMember.daysRemaining}天</Tag>
                  ) : (
                    <span>{detailMember.daysRemaining}天</span>
                  )
                ) : (
                  <Tag color="default">已过期</Tag>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="停车次数">{detailMember.totalParkingCount}次</Descriptions.Item>
              <Descriptions.Item label="累计时长">{detailMember.totalParkingHours.toFixed(1)}小时</Descriptions.Item>
            </Descriptions>

            <Divider />

            <div>
              <h4 style={{ marginBottom: 12 }}>
                <ClockCircleOutlined /> 最近停车记录
              </h4>
              {detailLoading ? (
                <div style={{ textAlign: 'center', padding: 20 }}>
                  加载中...
                </div>
              ) : parkingRecords.length > 0 ? (
                <List
                  dataSource={parkingRecords}
                  renderItem={(record) => (
                    <List.Item>
                      <List.Item.Meta
                        title={
                          <Space>
                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold' }}>{record.plateNo}</span>
                            <Tag color="blue">{record.spaceNo}</Tag>
                            <Tag color={record.status === 'parking' ? 'processing' : 'success'}>
                              {record.status === 'parking' ? '停车中' : '已完成'}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <div>入场：{formatDateTime(record.entryTime)}</div>
                            {record.exitTime && <div>出场：{formatDateTime(record.exitTime)}</div>}
                            {record.duration !== null && (
                              <div>时长：{formatDuration(record.duration)}</div>
                            )}
                            {record.fee !== null && (
                              <div>费用：<span style={{ color: '#f5222d' }}>¥{record.fee.toFixed(2)}</span></div>
                            )}
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{ textAlign: 'center', padding: 20, color: '#999' }}>
                  暂无停车记录
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default MemberManagement;
