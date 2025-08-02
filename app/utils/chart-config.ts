export function getChartOption(data: number[], color: string) {
  return {
    backgroundColor: 'transparent',
    grid: {
      left: '15%',
      right: '15%',
      top: '10%',
      bottom: '25%',
      containLabel: false,
    },
    xAxis: {
      type: 'category',
      data: ['', '', '', '', '', '', ''], // Empty labels for clean look
      axisLine: {
        show: true,
        lineStyle: {
          color: '#525252', // neutral-600 for axis line
          width: 1,
        },
      },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false },
    },
    yAxis: {
      type: 'value',
      min: 0,
      max: 1,
      interval: 0.2,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        color: '#9CA3AF', // neutral-400
        fontSize: 10,
        formatter: '{value}',
      },
      splitLine: {
        show: true,
        lineStyle: {
          color: '#404040', // neutral-700 for grid lines
          width: 1,
          type: 'solid',
        },
      },
    },
    series: [
      {
        data: data,
        type: 'bar',
        itemStyle: {
          color: color,
          borderRadius: [2, 2, 0, 0],
        },
        barWidth: '20%',
        emphasis: {
          itemStyle: {
            color: color,
            opacity: 0.9,
          },
        },
      },
    ],
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1F2937',
      borderColor: '#374151',
      borderWidth: 1,
      textStyle: {
        color: '#F9FAFB',
        fontSize: 12,
      },
      formatter: function (params: Array<{ name: string; value: number }>) {
        const dataPoint = params[0];
        return `Value: ${dataPoint.value}`;
      },
    },
  };
}
