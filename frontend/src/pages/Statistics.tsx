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
  Space
} from 'antd';
import {
  DollarOutlined,
  CarOutlined,
  CalendarOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import type { Dayjs } from 'dayjs';
import ReactECharts from 'echarts-for-react';
import type { EChartsOption } from 'echarts';
import { statsApi } from '../services/api';
import type {
  DashboardData,
  RevenueTrendItem,
  PeakHourItem,
  PaymentTypeStat,
  ParkingRecord,
  TurnoverItem
} from '../types';
import {
  formatDuration,
  formatDateTime,
  paymentTypeMap,
  spaceTypeMap
} from '../utils';

const { RangePicker } = DatePicker;
const { Search } = Input;
const { Option } = Select;

function Statistics() {
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [revenueTrend, setRevenueTrend] = useState<RevenueTrendItem[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourItem[]>([]);
  const [paymentTypes, setPaymentTypes] = useState<PaymentTypeStat[]>([]);

  const [recordDateRange, setRecordDateRange] = useState<[Dayjs, Dayjs] | null>(null);
  const [recordPlateNo, setRecordPlateNo] = useState('');
  const [records, setRecords] = useState<ParkingRecord[]>([]);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsPageSize, setRecordsPageSize] = useState(10);
  const [recordsLoading, setRecordsLoading] = useState(false);

  const [turnoverDays, setTurnoverDays] = useState(7);
  const [turnoverData, setTurnoverData] = useState<TurnoverItem[]>([]);
  const [turnoverLoading, setTurnoverLoading] = useState(false);

  const fetchOverviewData = async () => {
    try {
      setLoading(true);
      const [dashboardRes, trendRes, peakRes, paymentRes] = await Promise.all([
        statsApi.getDashboard(),
        statsApi.getRevenueTrend(7),
        statsApi.getPeakHours(7),
        statsApi.getPaymentTypes()
      ]);

      if (dashboardRes.success && dashboardRes.data) {
        setDashboardData(dashboardRes.data);
      }
      if (trendRes.success && trendRes.data) {
        setRevenueTrend(trendRes.data);
      }
      if (peakRes.success && peakRes.data) {
        setPeakHours(peakRes.data);
      }
      if (paymentRes.success && paymentRes.data) {
        setPaymentTypes(paymentRes.data);
      }
    } catch (error) {
      message.error('获取统计数据失败，请稍后重试');
      console.error('Statistics fetch error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchRecords = async () => {
    try {
      setRecordsLoading(true);
      const params: {
        startDate?: string;
        endDate?: string;
        plateNo?: string;
        page?: number;
        pageSize?: number;
      } = {
        page: recordsPage,
        pageSize: recordsPageSize
      };

      if (recordDateRange && recordDateRange[0] && recordDateRange[1]) {
        params.startDate = recordDateRange[0].format('YYYY-MM-DD');
        params.endDate = recordDateRange[1].format('YYYY-MM-DD');
      }
      if (recordPlateNo) {
        params.plateNo = recordPlateNo;
      }

      const res = await statsApi.getRecords(params);
      if (res.success && res.data) {
        setRecords(res.data.records);
        setRecordsTotal(res.data.total);
      }
    } catch (error) {
      message.error('获取停车记录失败，请稍后重试');
      console.error('Records fetch error:', error);
    } finally {
      setRecordsLoading(false);
    }
  };

  const fetchTurnover = async () => {
    try {
      setTurnoverLoading(true);
      const res = await statsApi.getTurnover(turnoverDays);
      if (res.success && res.data) {
        const sorted = [...res.data].sort((a, b) => b.dailyTurnover - a.dailyTurnover);
        setTurnoverData(sorted);
      }
    } catch (error) {
      message.error('获取周转率数据失败，请稍后重试');
      console.error('Turnover fetch error:', error);
    } finally {
      setTurnoverLoading(false);
    }
  };

  useEffect(() => {
    fetchOverviewData();
  }, []);

  useEffect(() => {
    if (activeTab === 'records') {
      fetchRecords();
    }
  }, [activeTab, recordsPage, recordsPageSize]);

  useEffect(() => {
    if (activeTab === 'turnover') {
      fetchTurnover();
    }
  }, [activeTab, turnoverDays]);

  const handleSearchRecords = () => {
    setRecordsPage(1);
    fetchRecords();
  };

  const handleResetRecords = () => {
    setRecordDateRange(null);
    setRecordPlateNo('');
    setRecordsPage(1);
  };

  const getRevenueTrendOption = (): EChartsOption => {
    const dates = revenueTrend.map(item => item.date);
    const incomes = revenueTrend.map(item => item.income);
    const counts = revenueTrend.map(item => item.count);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'cross'
        },
        formatter: (params: any) => {
          let result = `<div style="font-weight: 600; margin-bottom: 8px;">${params[0].axisValue}</div>`;
          params.forEach((param: any) => {
            const unit = param.seriesName === '收入' ? ' 元' : ' 辆';
            result += `<div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              <span>${param.seriesName}：</span>
              <span style="font-weight: 600;">${param.value}${unit}</span>
            </div>`;
          });
          return result;
        }
      },
      legend: {
        data: ['收入', '订单数'],
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
        boundaryGap: false,
        data: dates,
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          color: '#8c8c8c'
        }
      },
      yAxis: [
        {
          type: 'value',
          name: '收入(元)',
          position: 'left',
          axisLine: {
            show: true,
            lineStyle: {
              color: '#667eea'
            }
          },
          axisLabel: {
            color: '#8c8c8c',
            formatter: '{value}'
          },
          splitLine: {
            lineStyle: {
              color: '#f0f0f0'
            }
          }
        },
        {
          type: 'value',
          name: '订单数(辆)',
          position: 'right',
          axisLine: {
            show: true,
            lineStyle: {
              color: '#f093fb'
            }
          },
          axisLabel: {
            color: '#8c8c8c',
            formatter: '{value}'
          },
          splitLine: {
            show: false
          }
        }
      ],
      series: [
        {
          name: '收入',
          type: 'line',
          yAxisIndex: 0,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
              colorStops: [
                { offset: 0, color: '#667eea' },
                { offset: 1, color: '#764ba2' }
              ]
            }
          },
          itemStyle: {
            color: '#667eea',
            borderWidth: 2,
            borderColor: '#fff'
          },
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(102, 126, 234, 0.3)' },
                { offset: 1, color: 'rgba(102, 126, 234, 0.05)' }
              ]
            }
          },
          data: incomes
        },
        {
          name: '订单数',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 8,
          lineStyle: {
            width: 3,
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 1,
              y2: 0,
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
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(240, 147, 251, 0.3)' },
                { offset: 1, color: 'rgba(240, 147, 251, 0.05)' }
              ]
            }
          },
          data: counts
        }
      ],
      color: ['#667eea', '#f093fb']
    };
  };

  const getPeakHoursOption = (): EChartsOption => {
    const hours = peakHours.map(item => item.hour);
    const counts = peakHours.map(item => item.count);

    return {
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const param = params[0];
          return `<div style="font-weight: 600; margin-bottom: 8px;">${param.axisValue}</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${param.color};"></span>
              <span>平均在场车辆：</span>
              <span style="font-weight: 600;">${param.value} 辆</span>
            </div>`;
        }
      },
      grid: {
        left: '3%',
        right: '4%',
        bottom: '3%',
        top: '10%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: hours,
        axisLine: {
          lineStyle: {
            color: '#d9d9d9'
          }
        },
        axisLabel: {
          color: '#8c8c8c',
          interval: 0,
          rotate: 45
        }
      },
      yAxis: {
        type: 'value',
        name: '平均车辆数',
        axisLine: {
          show: true,
          lineStyle: {
            color: '#4facfe'
          }
        },
        axisLabel: {
          color: '#8c8c8c'
        },
        splitLine: {
          lineStyle: {
            color: '#f0f0f0'
          }
        }
      },
      series: [
        {
          name: '平均在场车辆',
          type: 'bar',
          barWidth: '60%',
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#4facfe' },
                { offset: 1, color: '#00f2fe' }
              ]
            },
            borderRadius: [4, 4, 0, 0]
          },
          emphasis: {
            itemStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  { offset: 0, color: '#00f2fe' },
                  { offset: 1, color: '#4facfe' }
                ]
              }
            }
          },
          data: counts
        }
      ]
    };
  };

  const getPaymentTypesOption = (): EChartsOption => {
    const data = paymentTypes.map(item => ({
      value: item.amount,
      name: item.name || paymentTypeMap[item.type as keyof typeof paymentTypeMap] || item.type
    }));

    return {
      tooltip: {
        trigger: 'item',
        formatter: (params: any) => {
          return `<div style="font-weight: 600; margin-bottom: 8px;">${params.name}</div>
            <div style="display: flex; justify-content: space-between; gap: 16px;">
              <span>金额：</span>
              <span style="font-weight: 600;">¥${params.value.toFixed(2)}</span>
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
        textStyle: {
          color: '#595959'
        }
      },
      series: [
        {
          name: '支付类型',
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
              formatter: (params: any) => `${params.name}\n¥${params.value.toFixed(2)}`
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
          color: ['#667eea', '#f093fb', '#4facfe', '#43e97b', '#fa709a']
        }
      ]
    };
  };

  const recordColumns: ColumnsType<ParkingRecord> = [
    {
      title: '车牌号',
      dataIndex: 'plateNo',
      key: 'plateNo',
      width: 130,
      render: (text: string) => (
        <span style={{ fontFamily: 'Courier New, monospace', fontWeight: 600 }}>{text}</span>
      )
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
      title: '出场时间',
      dataIndex: 'exitTime',
      key: 'exitTime',
      width: 180,
      render: (text: string | null) => formatDateTime(text)
    },
    {
      title: '停车时长',
      dataIndex: 'duration',
      key: 'duration',
      width: 120,
      render: (minutes: number | null) => minutes !== null ? formatDuration(minutes) : '-'
    },
    {
      title: '费用',
      dataIndex: 'fee',
      key: 'fee',
      width: 100,
      render: (fee: number | null) => fee !== null ? `¥${fee.toFixed(2)}` : '-'
    },
    {
      title: '支付方式',
      dataIndex: 'paymentType',
      key: 'paymentType',
      width: 120,
      render: (type: string | null) => {
        if (!type) return '-';
        const name = paymentTypeMap[type as keyof typeof paymentTypeMap] || type;
        return <Tag color="blue">{name}</Tag>;
      }
    },
    {
      title: '会员',
      dataIndex: 'memberName',
      key: 'member',
      width: 100,
      render: (name: string | undefined, record: ParkingRecord) => {
        if (record.memberId) {
          return <Tag color="gold">{name || '是'}</Tag>;
        }
        return <Tag>否</Tag>;
      }
    }
  ];

  const turnoverColumns: ColumnsType<TurnoverItem> = [
    {
      title: '车位号',
      dataIndex: 'spaceNo',
      key: 'spaceNo',
      width: 100,
      render: (text: string, _record: TurnoverItem, index: number) => (
        <span style={{
          fontWeight: index < 10 ? 600 : 400,
          color: index < 3 ? '#f5222d' : index < 10 ? '#fa8c16' : '#262626'
        }}>
          {index < 10 && <span style={{ marginRight: 8 }}>🏆</span>}
          {text}
        </span>
      )
    },
    {
      title: '楼层',
      dataIndex: 'floor',
      key: 'floor',
      width: 80,
      render: (floor: number) => `B${floor}层`
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type: string) => {
        const name = spaceTypeMap[type as keyof typeof spaceTypeMap] || type;
        return <Tag>{name}</Tag>;
      }
    },
    {
      title: '使用次数',
      dataIndex: 'usageCount',
      key: 'usageCount',
      width: 100,
      sorter: (a, b) => a.usageCount - b.usageCount
    },
    {
      title: '日均周转率',
      dataIndex: 'dailyTurnover',
      key: 'dailyTurnover',
      width: 120,
      sorter: (a, b) => a.dailyTurnover - b.dailyTurnover,
      defaultSortOrder: 'descend',
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#1890ff' }}>
          {value.toFixed(2)} 次/天
        </span>
      )
    },
    {
      title: '平均停车时长',
      dataIndex: 'avgDuration',
      key: 'avgDuration',
      width: 130,
      render: (minutes: number) => formatDuration(minutes)
    },
    {
      title: '累计收入',
      dataIndex: 'totalIncome',
      key: 'totalIncome',
      width: 120,
      sorter: (a, b) => a.totalIncome - b.totalIncome,
      render: (value: number) => (
        <span style={{ fontWeight: 600, color: '#52c41a' }}>
          ¥{value.toFixed(2)}
        </span>
      )
    }
  ];

  const renderOverview = () => (
    <Spin spinning={loading} tip="数据加载中...">
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
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>今日收入</span>}
              value={dashboardData?.todayIncome || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#fff' }} />}
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
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>本周收入</span>}
              value={dashboardData?.weekIncome || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#fff' }} />}
              suffix="元"
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
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>本月收入</span>}
              value={dashboardData?.monthIncome || 0}
              precision={2}
              prefix={<DollarOutlined style={{ color: '#fff' }} />}
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
              title={<span style={{ color: 'rgba(255,255,255,0.85)', fontSize: 14 }}>今日订单数</span>}
              value={dashboardData?.todayCount || 0}
              prefix={<CarOutlined style={{ color: '#fff' }} />}
              suffix="辆"
              valueStyle={{ color: '#fff', fontSize: 28, fontWeight: 600 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24} lg={16}>
          <div className="chart-container">
            <div className="chart-title">
              <Space>
                <CalendarOutlined style={{ color: '#667eea' }} />
                最近7天收入趋势
              </Space>
            </div>
            <ReactECharts
              option={getRevenueTrendOption()}
              style={{ height: 350 }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </Col>
        <Col xs={24} lg={8}>
          <div className="chart-container">
            <div className="chart-title">
              <Space>
                <DollarOutlined style={{ color: '#f093fb' }} />
                支付类型占比
              </Space>
            </div>
            <ReactECharts
              option={getPaymentTypesOption()}
              style={{ height: 350 }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </Col>
      </Row>

      <Row gutter={[16, 16]}>
        <Col xs={24}>
          <div className="chart-container">
            <div className="chart-title">
              <Space>
                <CarOutlined style={{ color: '#4facfe' }} />
                高峰时段分布（最近7天平均）
              </Space>
            </div>
            <ReactECharts
              option={getPeakHoursOption()}
              style={{ height: 300 }}
              notMerge={true}
              lazyUpdate={true}
            />
          </div>
        </Col>
      </Row>
    </Spin>
  );

  const renderRecords = () => (
    <div>
      <Card
        style={{ marginBottom: 16, borderRadius: 12 }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[16, 16]} align="middle">
          <Col>
            <RangePicker
              value={recordDateRange}
              onChange={(dates) => setRecordDateRange(dates as [Dayjs, Dayjs] | null)}
              style={{ width: 280 }}
              placeholder={['开始日期', '结束日期']}
            />
          </Col>
          <Col>
            <Search
              placeholder="输入车牌号搜索"
              value={recordPlateNo}
              onChange={(e) => setRecordPlateNo(e.target.value)}
              onSearch={handleSearchRecords}
              style={{ width: 240 }}
              allowClear
            />
          </Col>
          <Col>
            <Space>
              <Button
                type="primary"
                icon={<SearchOutlined />}
                onClick={handleSearchRecords}
              >
                查询
              </Button>
              <Button
                icon={<ReloadOutlined />}
                onClick={handleResetRecords}
              >
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={recordColumns}
          dataSource={records}
          rowKey="id"
          loading={recordsLoading}
          pagination={{
            current: recordsPage,
            pageSize: recordsPageSize,
            total: recordsTotal,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            onChange: (page, pageSize) => {
              setRecordsPage(page);
              setRecordsPageSize(pageSize);
            }
          }}
          scroll={{ x: 1100 }}
          locale={{ emptyText: '暂无停车记录' }}
        />
      </Card>
    </div>
  );

  const renderTurnover = () => (
    <div>
      <Card
        style={{ marginBottom: 16, borderRadius: 12 }}
        bodyStyle={{ padding: 16 }}
      >
        <Row gutter={[16, 16]} align="middle" justify="space-between">
          <Col>
            <Space>
              <span style={{ color: '#595959' }}>时间段：</span>
              <Select
                value={turnoverDays}
                onChange={setTurnoverDays}
                style={{ width: 140 }}
              >
                <Option value={7}>最近7天</Option>
                <Option value={30}>最近30天</Option>
                <Option value={90}>最近90天</Option>
              </Select>
              <Tag color="blue">
                🏆 高亮显示周转率最高的前10个车位
              </Tag>
            </Space>
          </Col>
          <Col>
            <Button icon={<ReloadOutlined />} onClick={fetchTurnover}>
              刷新数据
            </Button>
          </Col>
        </Row>
      </Card>

      <Card style={{ borderRadius: 12 }} bodyStyle={{ padding: 0 }}>
        <Table
          columns={turnoverColumns}
          dataSource={turnoverData}
          rowKey="id"
          loading={turnoverLoading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 个车位`,
            pageSize: 20
          }}
          scroll={{ x: 900 }}
          locale={{ emptyText: '暂无周转率数据' }}
          rowClassName={(_record, index) => {
            if (index < 3) return 'table-row-highlight-first';
            if (index < 10) return 'table-row-highlight';
            return '';
          }}
          onRow={(_record, index) => ({
            style: index !== undefined && index < 10 ? {
              background: index < 3
                ? 'linear-gradient(90deg, rgba(255, 77, 79, 0.08) 0%, transparent 100%)'
                : 'linear-gradient(90deg, rgba(250, 140, 22, 0.08) 0%, transparent 100%)'
            } : {}
          })}
        />
      </Card>
    </div>
  );

  const tabItems = [
    {
      key: 'overview',
      label: '收入概览',
      children: renderOverview()
    },
    {
      key: 'records',
      label: '停车记录',
      children: renderRecords()
    },
    {
      key: 'turnover',
      label: '车位周转率',
      children: renderTurnover()
    }
  ];

  return (
    <div style={{ padding: 24, background: '#f0f2f5', minHeight: '100%' }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: 24, fontWeight: 600, color: '#262626' }}>收入统计</h2>
        <p style={{ margin: '8px 0 0 0', color: '#8c8c8c' }}>查看停车场运营收入、停车记录和车位周转率统计数据</p>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        items={tabItems}
        size="large"
        style={{ background: 'transparent' }}
      />
    </div>
  );
}

export default Statistics;
