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
  Radio,
  Descriptions,
  InputNumber
} from 'antd';
import {
  FileTextOutlined,
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  SendOutlined,
  PrinterOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import dayjs from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { invoiceApi, recordApi } from '../services/api';
import type { Invoice, InvoiceMonthlyStat, ParkingRecord } from '../types';
import {
  formatDateTime,
  invoiceStatusMap,
  invoiceStatusColorMap,
  invoiceTypeMap
} from '../utils';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

function InvoiceManagement() {
  const [activeTab, setActiveTab] = useState('list');
  const [loading, setLoading] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [invoicesTotal, setInvoicesTotal] = useState(0);
  const [invoicesPage, setInvoicesPage] = useState(1);
  const [invoicesPageSize, setInvoicesPageSize] = useState(10);

  const [plateNo, setPlateNo] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs] | null>(null);

  const [applyModalVisible, setApplyModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [invoiceHtml, setInvoiceHtml] = useState('');
  const [applyForm] = Form.useForm();
  const [applyLoading, setApplyLoading] = useState(false);
  const [eligibleRecords, setEligibleRecords] = useState<ParkingRecord[]>([]);

  const [statsYear, setStatsYear] = useState(dayjs().year());
  const [monthlyStats, setMonthlyStats] = useState<InvoiceMonthlyStat[]>([]);
  const [yearTotal, setYearTotal] = useState({ totalAmount: 0, totalCount: 0 });
  const [statsLoading, setStatsLoading] = useState(false);

  const fetchInvoices = async () => {
    try {
      setLoading(true);
      const params: any = {
        page: invoicesPage,
        pageSize: invoicesPageSize
      };
      if (plateNo) params.plateNo = plateNo;
      if (statusFilter && statusFilter !== 'all') params.status = statusFilter;
      if (dateRange && dateRange[0]) params.startDate = dateRange[0].format('YYYY-MM-DD');
      if (dateRange && dateRange[1]) params.endDate = dateRange[1].format('YYYY-MM-DD');

      const res = await invoiceApi.getList(params);
      if (res.success && res.data) {
        setInvoices(res.data.invoices);
        setInvoicesTotal(res.data.total);
      }
    } catch (error) {
      message.error('获取发票列表失败');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const res = await invoiceApi.getMonthlyStats(statsYear);
      if (res.success && res.data) {
        setMonthlyStats(res.data.monthlyStats);
        setYearTotal(res.data.yearTotal);
      }
    } catch (error) {
      message.error('获取统计数据失败');
      console.error(error);
    } finally {
      setStatsLoading(false);
    }
  };

  const fetchEligibleRecords = async () => {
    try {
      const res = await recordApi.getRecords({ status: 'completed', pageSize: 100 });
      if (res.success && res.data) {
        const filtered = res.data.records.filter(
          (r: ParkingRecord) => r.fee !== null && r.fee > 0
        );
        setEligibleRecords(filtered);
      }
    } catch (error) {
      console.error('获取停车记录失败', error);
    }
  };

  useEffect(() => {
    if (activeTab === 'list') {
      fetchInvoices();
    }
  }, [activeTab, invoicesPage, invoicesPageSize]);

  useEffect(() => {
    if (activeTab === 'stats') {
      fetchStats();
    }
  }, [activeTab, statsYear]);

  const handleSearch = () => {
    setInvoicesPage(1);
    fetchInvoices();
  };

  const handleReset = () => {
    setPlateNo('');
    setStatusFilter('all');
    setDateRange(null);
    setInvoicesPage(1);
    fetchInvoices();
  };

  const handleApplyInvoice = async (values: any) => {
    try {
      setApplyLoading(true);
      const res = await invoiceApi.create({
        recordId: values.recordId,
        invoiceType: values.invoiceType,
        title: values.title,
        taxNo: values.taxNo,
        email: values.email
      });

      if (res.success) {
        message.success('发票申请已提交，正在开具中...');
        setApplyModalVisible(false);
        applyForm.resetFields();
        setTimeout(() => {
          fetchInvoices();
          message.info('发票已开具完成！');
        }, 2500);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || '发票申请失败');
    } finally {
      setApplyLoading(false);
    }
  };

  const handleViewDetail = async (invoice: Invoice) => {
    try {
      setSelectedInvoice(invoice);
      const html = await invoiceApi.getHtml(invoice.id);
      setInvoiceHtml(html);
      setDetailModalVisible(true);
    } catch (error) {
      message.error('获取发票详情失败');
    }
  };

  const handleResend = async (invoice: Invoice) => {
    try {
      const res = await invoiceApi.resend(invoice.id);
      if (res.success) {
        message.success(`发票已重新发送至 ${invoice.email}`);
      }
    } catch (error) {
      message.error('重发失败');
    }
  };

  const getStatsChartOption = (): EChartsOption => {
    const months = monthlyStats.map(s => s.month);
    const amounts = monthlyStats.map(s => s.totalAmount);
    const counts = monthlyStats.map(s => s.totalCount);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'cross' }
      },
      legend: {
        data: ['开票金额', '开票张数'],
        top: 0
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '15%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { color: '#8c8c8c' }
      },
      yAxis: [
        {
          type: 'value',
          name: '金额(元)',
          axisLine: { show: true, lineStyle: { color: '#667eea' } },
          axisLabel: { color: '#8c8c8c' }
        },
        {
          type: 'value',
          name: '张数',
          axisLine: { show: true, lineStyle: { color: '#f093fb' } },
          axisLabel: { color: '#8c8c8c' }
        }
      ],
      series: [
        {
          name: '开票金额',
          type: 'bar',
          yAxisIndex: 0,
          data: amounts,
          itemStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 1, color: '#764ba2' }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          }
        },
        {
          name: '开票张数',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          data: counts,
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 1, y2: 0,
              colorStops: [
                { offset: 0, color: '#f093fb' },
                { offset: 1, color: '#f5576c' }
              ]
            }
          },
          itemStyle: {
            color: '#f093fb',
            borderWidth: 2,
            borderColor: '#fff'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0, y: 0, x2: 0, y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(240, 147, 251, 0.3)' },
                { offset: 1, color: 'rgba(240, 147, 251, 0.05)' }
              ]
            }
          }
        }
      ],
      color: ['#667eea', '#f093fb']
    };
  };

  const invoiceColumns: ColumnsType<Invoice> = [
    {
      title: '发票号码',
      dataIndex: 'invoiceNo',
      key: 'invoiceNo',
      width: 200,
      render: (text: string) => (
        <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600, color: '#1890ff' }}>
          {text}
        </span>
      )
    },
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
      title: '开票金额',
      dataIndex: 'amount',
      key: 'amount',
      width: 100,
      render: (amount: number) => (
        <span style={{ fontWeight: 600, color: '#f5222d' }}>¥{amount.toFixed(2)}</span>
      )
    },
    {
      title: '发票类型',
      dataIndex: 'invoiceType',
      key: 'invoiceType',
      width: 100,
      render: (type: string) => (
        <Tag color="blue">{invoiceTypeMap[type as keyof typeof invoiceTypeMap]}</Tag>
      )
    },
    {
      title: '发票抬头',
      dataIndex: 'title',
      key: 'title',
      width: 150,
      ellipsis: true
    },
    {
      title: '接收邮箱',
      dataIndex: 'email',
      key: 'email',
      width: 180,
      ellipsis: true
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={invoiceStatusColorMap[status as keyof typeof invoiceStatusColorMap]}>
          {invoiceStatusMap[status as keyof typeof invoiceStatusMap]}
        </Tag>
      )
    },
    {
      title: '开具时间',
      dataIndex: 'issuedAt',
      key: 'issuedAt',
      width: 180,
      render: (text: string | null) => formatDateTime(text)
    },
    {
      title: '申请时间',
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
      render: (_: any, record: Invoice) => (
        <Space>
          <Button
            type="link"
            size="small"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            查看
          </Button>
          {record.status === 'issued' && (
            <Button
              type="link"
              size="small"
              icon={<SendOutlined />}
              onClick={() => handleResend(record)}
            >
              重发
            </Button>
          )}
        </Space>
      )
    }
  ];

  const renderInvoiceList = () => (
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
                onSearch={handleSearch}
                style={{ width: 200 }}
                allowClear
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 140 }}
              >
                <Option value="all">全部状态</Option>
                <Option value="pending">待开具</Option>
                <Option value="issued">已开具</Option>
                <Option value="failed">开具失败</Option>
              </Select>
              <Space>
                <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                  查询
                </Button>
                <Button icon={<ReloadOutlined />} onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </Space>
          </Col>
          <Col>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => {
                fetchEligibleRecords();
                setApplyModalVisible(true);
              }}
            >
              申请开票
            </Button>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={invoiceColumns}
          dataSource={invoices}
          rowKey="id"
          loading={loading}
          pagination={{
            current: invoicesPage,
            pageSize: invoicesPageSize,
            total: invoicesTotal,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setInvoicesPage(page);
              setInvoicesPageSize(pageSize);
            }
          }}
          scroll={{ x: 1400 }}
          locale={{ emptyText: '暂无发票记录' }}
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
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              borderRadius: 12,
              border: 'none'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>全年开票金额</span>}
              value={yearTotal.totalAmount}
              precision={2}
              prefix={<FileTextOutlined style={{ color: '#fff' }} />}
              suffix="元"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
              borderRadius: 12,
              border: 'none'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>全年开票张数</span>}
              value={yearTotal.totalCount}
              prefix={<FileTextOutlined style={{ color: '#fff' }} />}
              suffix="张"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
              borderRadius: 12,
              border: 'none'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>平均单张金额</span>}
              value={yearTotal.totalCount > 0 ? yearTotal.totalAmount / yearTotal.totalCount : 0}
              precision={2}
              prefix={<FileTextOutlined style={{ color: '#fff' }} />}
              suffix="元"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
              borderRadius: 12,
              border: 'none'
            }}
            bodyStyle={{ padding: 24 }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>统计年份</span>}
              value={statsYear}
              suffix="年"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        title={
          <Space>
            <span>选择年份</span>
            <Select
              value={statsYear}
              onChange={setStatsYear}
              style={{ width: 140 }}
            >
              {Array.from({ length: 5 }, (_, i) => dayjs().year() - i).map(year => (
                <Option key={year} value={year}>{year}年</Option>
              ))}
            </Select>
          </Space>
        }
        style={{ borderRadius: 12 }}
      >
        <ReactECharts
          option={getStatsChartOption()}
          style={{ height: 400 }}
          notMerge={true}
          lazyUpdate={true}
        />
      </Card>
    </Spin>
  );

  const tabItems = [
    {
      key: 'list',
      label: '发票列表',
      children: renderInvoiceList()
    },
    {
      key: 'stats',
      label: '开票统计',
      children: renderStats()
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#262626' }}>电子发票管理</h2>
        <p style={{ margin: '8px 0 0 0', color: '#8c8c8c' }}>管理电子发票的申请、查询和统计</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
      />

      <Modal
        title="申请开具电子发票"
        open={applyModalVisible}
        onCancel={() => setApplyModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={applyForm}
          layout="vertical"
          onFinish={handleApplyInvoice}
        >
          <Form.Item
            name="recordId"
            label="选择停车记录"
            rules={[{ required: true, message: '请选择停车记录' }]}
          >
            <Select placeholder="请选择要开票的停车记录">
              {eligibleRecords.map(record => (
                <Option key={record.id} value={record.id}>
                  {record.plateNo} - {record.spaceNo} - ¥{record.fee?.toFixed(2)} ({formatDateTime(record.entryTime)})
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            name="invoiceType"
            label="发票类型"
            rules={[{ required: true, message: '请选择发票类型' }]}
            initialValue="personal"
          >
            <Radio.Group>
              <Radio value="personal">个人发票</Radio>
              <Radio value="company">企业发票</Radio>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="title"
            label="发票抬头"
            rules={[{ required: true, message: '请输入发票抬头' }]}
          >
            <Input placeholder="请输入发票抬头" />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, curValues) => prevValues.invoiceType !== curValues.invoiceType}
          >
            {({ getFieldValue }) =>
              getFieldValue('invoiceType') === 'company' ? (
                <Form.Item
                  name="taxNo"
                  label="纳税人识别号"
                  rules={[{ required: true, message: '请输入纳税人识别号' }]}
                >
                  <Input placeholder="请输入纳税人识别号" />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="email"
            label="接收邮箱"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' }
            ]}
          >
            <Input placeholder="请输入接收发票的邮箱地址" />
          </Form.Item>

          <Form.Item>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setApplyModalVisible(false)}>取消</Button>
              <Button type="primary" htmlType="submit" loading={applyLoading}>
                提交申请
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="发票详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        width={900}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={() => window.print()}>
            打印
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <div
          dangerouslySetInnerHTML={{ __html: invoiceHtml }}
          style={{ maxHeight: '600px', overflow: 'auto' }}
        />
      </Modal>
    </div>
  );
}

export default InvoiceManagement;
