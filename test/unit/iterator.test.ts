import fs from 'fs';
import { getMetricsFromIterator, PromData, PromSummaryData } from '../../src/prom'

const CounterData =[
    '# HELP go_memstats_alloc_bytes_total Total number of bytes allocated, even if freed.',
    '# TYPE go_memstats_alloc_bytes_total counter',
    'go_memstats_alloc_bytes_total 3.7156890216e+10'    
];

function verifyCounter(metrics) {
    expect(Object.keys(metrics).length).toEqual(1);

    const metric = metrics['go_memstats_alloc_bytes_total'];

    expect(metric).not.toBeNull();
    expect(metric.type).toEqual('counter');
    expect(metric.data).not.toBeNull();
    expect(metric.data.length).toEqual(1);

    const datum = metric.data[0] as PromData;

    expect(datum.value).toEqual(3.7156890216e+10);
}

it('gets input from an array', () => {
    return getMetricsFromIterator(CounterData[Symbol.iterator]()).then(metrics => {
        verifyCounter(metrics);
    });
});

it('gets input from a generator', () => {
    const input = function* () {
        yield CounterData[0];
        yield CounterData[1];
        yield CounterData[2];
    }

    return getMetricsFromIterator(input()).then(metrics => {
        verifyCounter(metrics);
    });
});

it('gets input from a string', () => {
    const block = fs.readFileSync('test/unit/mixed.test.data.txt', 'utf8');
    
    expect(typeof block).toEqual('string');

    const input = block.split('\n');

    return getMetricsFromIterator(input[Symbol.iterator]()).then(metrics => {
        expect(Object.keys(metrics).length).toEqual(6);

        const metric = metrics['rpc_duration_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('summary');

        const summaryData = metric.data as PromSummaryData[];

        expect(summaryData[0].count).toEqual(2693); // Last line in file
    });
});
