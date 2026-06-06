import { useState, useEffect } from 'react';
import {
  Tabs,
  DatePicker,
  Input,
  Button,
  Table,
  Row,
  Col,
  Card,
  Statistic,
  Select,
  Spin,
  message,
  Tag,
  Space,
  Modal,
  Form,
  Descriptions,
  Alert,
  InputNumber,
  Popconfirm,
  Tooltip
} from 'antd';
import {
  WarningOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  UserAddOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
  SafetyOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { violationApi } from '../services/api';
import type {
  Violation,
  Blacklist,
  ViolationTypeStat,
  ViolationStatus,
  ViolationType
} from '../types';
import {
  formatDateTime,
  violationTypeMap,
  violationStatusMap,
  violationStatusColorMap,
  blacklistStatusMap,
  blacklistStatusColorMap
} from '../utils';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

function ViolationManagement() {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [violations, setViolations] = useState<Violation[]>([]);
  const [violationsTotal, setViolationsTotal] = useState(0);
  const [violationsPage, setViolationsPage] = useState(1);
  const [violationsPageSize, setViolationsPageSize] = useState(10);

  const [plateNo, setPlateNo] = useState('');
  const [violationTypeFilter, setViolationTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addForm] = Form.useForm();
  const [addLoading, setAddLoading] = useState(false);

  const [checkModalVisible, setCheckModalVisible] = useState(false);
  const [checkPlateNo, setCheckPlateNo] = useState('');
  const [checkResult, setCheckResult] = useState<{
    isBlacklisted: boolean;
    blacklist?: Blacklist;
    recentViolations: Violation[];
    totalViolations: number;
  } | null>(null);
  const [checkLoading, setCheckLoading] = useState(false);

  const [stats, setStats] = useState<{ byType: ViolationTypeStat[]; totalCount: number }>({
    byType: [],
    totalCount: 0
  });
  const [statsLoading, setStatsLoading] = useState(false);

  const [blacklist, setBlacklist] = useState<Blacklist[]>([]);
  const [blacklistTotal, setBlacklistTotal] = useState(0);
  const [blacklistPage, setBlacklistPage] = useState(1);
  const [blacklistPageSize, setBlacklistPageSize] = useState(10);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [blacklistPlateNo, setBlacklistPlateNo] = useState('');
  const [blacklistStatusFilter, setBlacklistStatusFilter] = useState('active');

  const [addBlacklistModalVisible, setAddBlacklistModalVisible] = useState(false);
  const [addBlacklistForm] = Form.useForm();
  const [addBlacklistLoading, setAddBlacklistLoading] = useState(false);

  const fetchViolations = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: violationsPage,
        pageSize: violationsPageSize
      };
      if (plateNo) params.plateNo = plateNo;
      if (violationTypeFilter && violationTypeFilter !== 'all') params.violationType = violationTypeFilter;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (dateRange && dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');

      const res = await violationApi.getList(params);
      if (res.success && res.data) {
        setViolations(res.data.violations);
        setViolationsTotal(res.data.total);
      }
    } catch (error) {
      message.error('获取违章记录失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await violationApi.getStats();
      if (res.success && res.data) {
        setStats(res.data);
      }
    } catch (error) {
      message.error('获取统计数据失败');
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchBlacklist = async () => {
    try {
      setBlacklistLoading(true);
      const params: any = {
        page: blacklistPage,
        pageSize: blacklistPageSize
      };
      if (blacklistPlateNo) params.plateNo = blacklistPlateNo;
      if (blacklistStatusFilter && blacklistStatusFilter !== 'all') params.status = blacklistStatusFilter;

      const res = await violationApi.getBlacklist(params);
      if (res.success && res.data) {
        setBlacklist(res.data.blacklist);
        setBlacklistTotal(res.data.total);
      }
    } catch (error) {
      message.error('获取黑名单失败');
      console.error(error);
    } finally {
      setBlacklistLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchViolations();
    }
  }, [activeTab, violationsPage, violationsPageSize]);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === 'blacklist') {
      fetchBlacklist();
    }
  }, [activeTab, blacklistPage, blacklistPageSize]);

  const handleSearchViolations = () => {
    setViolationsPage(1);
    fetchViolations();
  };

  const handleResetViolations = () => {
    setPlateNo('');
    setViolationTypeFilter('all');
    setStatusFilter('all');
    setDateRange(null);
    setViolationsPage(1);
    fetchViolations();
  };

  const handleAddViolation = async (values: any) => {
    try {
      setAddLoading(true);
      const res = await violationApi.create({
        plateNo: values.plateNo.toUpperCase(),
        violationType: values.violationType,
        description: values.description,
        occurrenceTime: values.occurrenceTime?.format('YYYY-MM-DD HH:mm:ss')
      });

      if (res.success) {
        message.success(res.data?.message || '违章记录创建成功');
        setAddModalVisible(false);
        addForm.resetFields();
        fetchViolations();
        if (res.data?.addedToBlacklist) {
          Modal.warning({
            title: '车辆已加入黑名单',
            content: `车牌号 ${values.plateNo.toUpperCase()} 累计违章 ${res.data.violationCount} 次，已自动加入黑名单，将禁止入场。`
          });
        }
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '创建违章记录失败');
    } finally {
      setAddLoading(false);
    }
  };

  const handleUpdateStatus = async (id: number, status: ViolationStatus) => {
    try {
      const res = await violationApi.updateStatus(id, status);
      if (res.success) {
        message.success('状态更新成功');
        fetchViolations();
      }
    } catch (error) {
      message.error('状态更新失败');
    }
  };

  const handleCheckPlate = async () => {
    if (!checkPlateNo) {
      message.warning('请输入车牌号');
      return;
    }
    try {
      setCheckLoading(true);
      const res = await violationApi.checkPlate(checkPlateNo.toUpperCase());
      if (res.success && res.data) {
        setCheckResult(res.data);
        setCheckModalVisible(true);
      }
    } catch (error) {
      message.error('查询失败');
    } finally {
      setCheckLoading(false);
    }
  };

  const handleAddBlacklist = async (values: any) => {
    try {
      setAddBlacklistLoading(true);
      const res = await violationApi.addToBlacklist({
        plateNo: values.plateNo.toUpperCase(),
        reason: values.reason
      });

      if (res.success) {
        message.success('车辆已加入黑名单');
        setAddBlacklistModalVisible(false);
        addBlacklistForm.resetFields();
        fetchBlacklist();
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '加入黑名单失败');
    } finally {
      setAddBlacklistLoading(false);
    }
  };

  const handleRemoveBlacklist = async (id: number, reason?: string) => {
    try {
      const res = await violationApi.removeFromBlacklist(id, reason);
      if (res.success) {
        message.success('车辆已从黑名单移除');
        fetchBlacklist();
      }
    } catch (error) {
      message.error('移除失败');
    }
  };

  const getPieChartOption = (): EChartsOption => {
    const data = stats.byType.map(item => ({
      value: item.count,
      name: item.name
    }));

    const colors = ['#f5222d', '#fa8c16', '#faad14', '#1890ff', '#722ed1'];

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `<div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>数量：</span>
              <span style="font-weight: 600;">${params.value} 次</span>
            </div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>占比：</span>
              <span style="font-weight: 600;">${params.percent}%</span>
            </div>`;
        }
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: { color: '#595959' }
      },
      series: [
        {
          name: '违章类型',
          type: 'pie',
          radius: ['45%', '70%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 6,
            borderColor: '#fff',
            borderWidth: 2
          },
          label: {
            show: false,
            position: 'center'
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 16,
              fontWeight: 'bold',
              formatter: (params: any) => `${params.name}\n${params.value}次`
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.2)'
            }
          },
          labelLine: {
            show: false
          },
          data: data,
          color: colors
        }
      ]
    };
  };

  const violationColumns: ColumnsType<Violation> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text: string) => (
        <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600 }}>{text}</span>
      )
    },
    {
      title: '违章类型',
      dataIndex: 'violationTypeName',
      key: 'violationTypeName',
      width: 140,
      render: (text: string, record: Violation) => (
        <Tag color="red">
          <WarningOutlined style={{ marginRight: 4 }} />
          {text || violationTypeMap[record.violationType]}
        </Tag>
      )
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: '发生时间',
      dataIndex: 'occurrenceTime',
      key: 'occurrenceTime',
      width: 180,
      render: (text: string) => formatDateTime(text)
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: ViolationStatus) => (
        <Tag color={violationStatusColorMap[status]}>
          {violationStatusMap[status]}
        </Tag>
      )
    },
    {
      title: '记录时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      render: (text: string) => formatDateTime(text)
    },
    {
      title: '操作',
      key: 'actions',
      width: 180,
      fixed: 'right',
      render: (_: any, record: Violation) => (
        <Space>
          {record.status === 'pending' && (
            <>
              <Button
                type="link"
                size="small"
                icon={<CheckCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'processed')}
              >
                处理
              </Button>
              <Button
                type="link"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => handleUpdateStatus(record.id, 'appealed')}
              >
                申诉
              </Button>
            </>
          )}
        </Space>
      )
    }
  ];

  const blacklistColumns: ColumnsType<Blacklist> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 120,
      render: (text: string) => (
        <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600 }}>{text}</span>
      )
    },
    {
      title: '原因',
      dataIndex: 'reason',
      key: 'reason',
      ellipsis: true
    },
    {
      title: '违章次数',
      dataIndex: 'violationCount',
      key: 'violationCount',
      width: 100,
      render: (count: number) => (
        <Tag color={count >= 3 ? 'red' : 'orange'}>{count} 次</Tag>
      )
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={blacklistStatusColorMap[status as keyof typeof blacklistStatusColorMap]}>
          {blacklistStatusMap[status as keyof typeof blacklistStatusMap]}
        </Tag>
      )
    },
    {
      title: '加入时间',
      dataIndex: 'addedAt',
      key: 'addedAt',
      width: 180,
      render: (text: string) => formatDateTime(text)
    },
    {
      title: '移除时间',
      dataIndex: 'removedAt',
      key: 'removedAt',
      width: 180,
      render: (text: string | null) => formatDateTime(text)
    },
    {
      title: '操作',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_: any, record: Blacklist) => (
        <Space>
          {record.status === 'active' && (
            <Popconfirm
              title="确认移除黑名单"
              description="移除后该车辆将可以正常入场"
              onConfirm={() => handleRemoveBlacklist(record.id)}
              okText="确认移除"
              cancelText="取消"
            >
              <Button
                type="link"
                size="small"
                danger
                icon={<DeleteOutlined />}
              >
                移除
              </Button>
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  const renderViolationList = () => (
    <div>
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space wrap>
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates as [Dayjs, Dayjs] | null)}
                style={{ width: 280 }}
                placeholder={['开始日期', '结束日期']}
              />
              <Search
                placeholder="输入车牌号搜索"
                value={plateNo}
                onChange={(e) => setPlateNo(e.target.value)}
                onSearch={handleSearchViolations}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                value={violationTypeFilter}
                onChange={setViolationTypeFilter}
                style={{ width: 160 }}
              >
                <Option value="all">全部类型</Option>
                {Object.entries(violationTypeMap).map(([key, value]) => (
                  <Option key={key} value={key}>{value}</Option>
                ))}
              </Select>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
              >
                <Option value="all">全部状态</Option>
                {Object.entries(violationStatusMap).map(([key, value]) => (
                  <Option key={key} value={key}>{value}</Option>
                ))}
              </Select>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearchViolations}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleResetViolations}>
                  重置
                </Button>
              </Space>
            </Space>
          </Col>
          <Col>
            <Space>
              <Button
                icon={<SearchOutlined />}
                onClick={() => {
                  setCheckPlateNo('');
                  setCheckResult(null);
                  setCheckModalVisible(true);
                }}
              >
                车牌查询
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setAddModalVisible(true)}
              >
                新增违章
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={violationColumns}
          dataSource={violations}
          rowKey="id"
          loading={loading}
          pagination={{
            current: violationsPage,
            pageSize: violationsPageSize,
            total: violationsTotal,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setViolationsPage(page);
              setViolationsPageSize(pageSize);
            }
          }}
          scroll={{ x: 1200 }}
          locale={{ emptyText: '暂无违章记录' }}
        />
      </Card>
    </div>
  );

  const renderStats = () => (
    <Spin spinning={statsLoading} tip="数据加载中...">
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #f5222d 0%, #fa541c 100%)',
              borderRadius: 12,
              border: 'none'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>总违章次数</span>}
              value={stats.totalCount}
              prefix={<WarningOutlined style={{ color: '#fff' }} />}
              suffix="次"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        {stats.byType.slice(0, 3).map((item, index) => {
          const gradients = [
            'linear-gradient(135deg, #fa8c16 0%, #faad14 100%)',
            'linear-gradient(135deg, #faad14 0%, #fadb14 100%)',
            'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)'
          ];
          return (
            <Col xs={24} sm={12} md={6} key={item.type}>
              <Card
                style={{
                  background: gradients[index],
                  borderRadius: 12,
                  border: 'none'
                }}
                bodyStyle={{ padding: 24 }}
              >
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>{item.name}</span>}
                  value={item.count}
                  prefix={<WarningOutlined style={{ color: '#fff' }} />}
                  suffix="次"
                  valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
                />
              </Card>
            </Col>
          );
        })}
      </Row>

      <Card
        title={
          <Space>
            <WarningOutlined style={{ color: '#f5222d' }} />
            <span style={{ fontWeight: 600 }}>违章类型分布</span>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        {stats.byType.length > 0 ? (
          <ReactECharts
            option={getPieChartOption()}
            style={{ height: 400 }}
            notMerge={true}
            lazyUpdate={true}
          />
        ) : (
          <div style={{ textAlign: 'center', padding: '80px 0', color: '#8c8c8c' }}>
            <WarningOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
            <p>暂无违章统计数据</p>
          </div>
        )}
      </Card>
    </Spin>
  );

  const renderBlacklist = () => (
    <div>
      <Card style={{ marginBottom: 16, borderRadius: 12 }} bodyStyle={{ padding: 16 }}>
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space wrap>
              <Search
                placeholder="输入车牌号搜索"
                value={blacklistPlateNo}
                onChange={(e) => setBlacklistPlateNo(e.target.value)}
                onSearch={() => { setBlacklistPage(1); fetchBlacklist(); }}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                value={blacklistStatusFilter}
                onChange={setBlacklistStatusFilter}
                style={{ width: 140 }}
              >
                <Option value="all">全部状态</Option>
                {Object.entries(blacklistStatusMap).map(([key, value]) => (
                  <Option key={key} value={key}>{value}</Option>
                ))}
              </Select>
              <Button icon={<ReloadOutlined />} onClick={fetchBlacklist}>
                刷新
              </Button>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<UserAddOutlined />}
              onClick={() => setAddBlacklistModalVisible(true)}
            >
              加入黑名单
            </Button>
          </Col>
        </Row>
      </Card>

      {blacklistStatusFilter === 'active' && (
        <Alert
          message="黑名单提示"
          description="累计3次违章的车辆将自动加入黑名单，黑名单车辆将被禁止入场。"
          type="warning"
          showIcon
          style={{ marginBottom: 16, borderRadius: 8 }}
        />
      )}

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={blacklistColumns}
          dataSource={blacklist}
          rowKey="id"
          loading={blacklistLoading}
          pagination={{
            current: blacklistPage,
            pageSize: blacklistPageSize,
            total: blacklistTotal,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setBlacklistPage(page);
              setBlacklistPageSize(pageSize);
            }
          }}
          scroll={{ x: 1000 }}
          locale={{ emptyText: '暂无黑名单记录' }}
        />
      </Card>
    </div>
  );

  const tabItems = [
    {
      key: 'list',
      label: '违章记录',
      children: renderViolationList()
    },
    {
      key: 'stats',
      label: '违章统计',
      children: renderStats()
    },
    {
      key: 'blacklist',
      label: '黑名单管理',
      children: renderBlacklist()
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#262626' }}>违章管理</h2>
        <p style={{ margin: '8px 0 0 0', color: '#8c8c8c' }}>管理车辆违章记录、统计分析和黑名单</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      <Modal
        title="新增违章记录"
        open={addModalVisible}
        onCancel={() => setAddModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={addForm}
          layout="vertical"
          onFinish={handleAddViolation}
        >
          <Form.Item
            name="plateNo"
            label="车牌号"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input
              placeholder="请输入车牌号"
              onChange={(e) => e.target.value = e.target.value.toUpperCase()}
              maxLength={8}
            />
          </Form.Item>

          <Form.Item
            name="violationType"
            label="违章类型"
            rules={[{ required: true, message: '请选择违章类型' }]}
          >
            <Select placeholder="请选择违章类型">
              {Object.entries(violationTypeMap).map(([key, value]) => (
                <Option key={key} value={key}>{value}</Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="description"
            label="违章描述"
            rules={[{ required: true, message: '请输入违章描述' }]}
          >
            <TextArea
              placeholder="请输入违章描述"
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Form.Item
            name="occurrenceTime"
            label="发生时间"
          >
            <DatePicker
              showTime
              style={{ width: '100%' }}
              placeholder="选择发生时间，默认当前时间"
            />
          </Form.Item>

          <Alert
            message="温馨提示"
            description="累计3次违章的车辆将自动加入黑名单，禁止入场。"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={addLoading}>
                提交
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="车牌违章查询"
        open={checkModalVisible}
        onCancel={() => setCheckModalVisible(false)}
        width={600}
        footer={[
          <Button key="close" onClick={() => setCheckModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div style={{ marginBottom: 16 }}>
          <Space.Compact style={{ width: '100%' }}>
            <Input
              placeholder="请输入车牌号"
              value={checkPlateNo}
              onChange={(e) => setCheckPlateNo(e.target.value.toUpperCase())}
              onPressEnter={handleCheckPlate}
              maxLength={8}
            />
            <Button
              type="primary"
              icon={<SearchOutlined />}
              onClick={handleCheckPlate}
              loading={checkLoading}
            >
              查询
            </Button>
          </Space.Compact>
        </div>

        {checkResult && (
          <div>
            {checkResult.isBlacklisted && checkResult.blacklist && (
              <Alert
                message="该车辆已被列入黑名单"
                description={checkResult.blacklist.reason}
                type="error"
                showIcon
                style={{ marginBottom: 16 }}
              />
            )}

            <Card
              size="small"
              style={{ marginBottom: 16 }}
              title={
                <Space>
                  <SafetyOutlined />
                  <span>车辆信息</span>
                </Space>
              }
            >
              <Descriptions column={2} size="small">
                <Descriptions.Item label="车牌号">
                  <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600 }}>
                    {checkPlateNo.toUpperCase()}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="累计违章">
                  <Tag color={checkResult.totalViolations >= 3 ? 'red' : 'orange'}>
                    {checkResult.totalViolations} 次
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="黑名单状态">
                  <Tag color={checkResult.isBlacklisted ? 'red' : 'green'}>
                    {checkResult.isBlacklisted ? '已拉黑' : '正常'}
                  </Tag>
                </Descriptions.Item>
                {checkResult.blacklist && (
                  <Descriptions.Item label="拉黑时间">
                    {formatDateTime(checkResult.blacklist.addedAt)}
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>

            {checkResult.recentViolations.length > 0 && (
              <Card
                size="small"
                title={
                  <Space>
                    <WarningOutlined style={{ color: '#faad14' }} />
                    <span>最近违章记录</span>
                  </Space>
                }
              >
                {checkResult.recentViolations.map(v => (
                  <div
                    key={v.id}
                    style={{
                      padding: '12px 0',
                      borderBottom: '1px solid #f0f0f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}
                  >
                    <div>
                      <Tag color="red" style={{ marginRight: 8 }}>
                        {v.violationTypeName || violationTypeMap[v.violationType]}
                      </Tag>
                      <span style={{ color: '#595959' }}>{v.description}</span>
                    </div>
                    <div style={{ color: '#8c8c8c', fontSize: 12 }}>
                      {formatDateTime(v.occurrenceTime)}
                    </div>
                  </div>
                ))}
              </Card>
            )}

            {checkResult.recentViolations.length === 0 && (
              <div style={{ textAlign: 'center', padding: '40px 0', color: '#8c8c8c' }}>
                <CheckCircleOutlined style={{ fontSize: 48, marginBottom: 12, color: '#52c41a' }} />
                <p>该车辆暂无违章记录，保持良好！</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Modal
        title="加入黑名单"
        open={addBlacklistModalVisible}
        onCancel={() => setAddBlacklistModalVisible(false)}
        footer={null}
        width={500}
      >
        <Form
          form={addBlacklistForm}
          layout="vertical"
          onFinish={handleAddBlacklist}
        >
          <Form.Item
            name="plateNo"
            label="车牌号"
            rules={[{ required: true, message: '请输入车牌号' }]}
          >
            <Input
              placeholder="请输入车牌号"
              onChange={(e) => e.target.value = e.target.value.toUpperCase()}
              maxLength={8}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="拉黑原因"
            rules={[{ required: true, message: '请输入拉黑原因' }]}
          >
            <TextArea
              placeholder="请输入拉黑原因"
              rows={3}
              maxLength={200}
              showCount
            />
          </Form.Item>

          <Alert
            message="重要提示"
            description="加入黑名单后，该车辆将被禁止入场，请谨慎操作。"
            type="error"
            showIcon
            style={{ marginBottom: 16 }}
          />

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setAddBlacklistModalVisible(false)}>取消</Button>
              <Button type="primary" danger htmlType="submit" loading={addBlacklistLoading}>
                确认加入黑名单
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

export default ViolationManagement;
