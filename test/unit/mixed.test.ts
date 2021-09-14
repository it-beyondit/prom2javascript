import fs from 'fs';
import { getMetricsFromStream, PromData, PromHistogramData, PromSummaryData } from '../../src/prom'

it('parses a full fledged input', () => {
    const input = fs.createReadStream('test/unit/mixed.test.data.txt');
    
    return getMetricsFromStream(input).then(metrics => {
        expect(Object.keys(metrics).length).toEqual(6);

        // Standard counter
        let metric = metrics['http_requests_total'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('counter');
        expect(metric.help).toEqual('The total number of HTTP requests.');
        expect(metric.data).not.toBeNull();

        let data = metric.data as PromData[];

        expect(data.length).toEqual(2);
        
        const methodPost = data.filter(datum => datum.labels['method'] == 'post' );
        const code200 = data.filter(datum => datum.labels['code'] == '200');
        const code400 = data.filter(datum => datum.labels['code'] == '400');

        expect(methodPost.length).toEqual(2);

        expect(code200.length).toEqual(1);
        expect(code200[0].value).toEqual(1027);
        expect(code200[0].timestamp).toEqual(1395066363000);
        
        expect(code400.length).toEqual(1);
        expect(code400[0].value).toEqual(3);
        expect(code400[0].timestamp).toEqual(1395066363000);

        // Escaping in label values
        metric = metrics['msdos_file_access_time_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('unknown');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        data = metric.data as PromData[];

        expect(data[0].labels['path']).toEqual('C:\\DIR\\FILE.TXT');
        expect(data[0].labels['error']).toEqual('Cannot find file:\n"FILE.TXT"');
        expect(data[0].value).toEqual(1.458255915e9);
        expect(data[0].timestamp).toBeUndefined();

        // Minimalistic line
        metric = metrics['metric_without_timestamp_and_labels'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('unknown');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        data = metric.data as PromData[];

        expect(Object.keys(data[0].labels).length).toEqual(0);
        expect(data[0].value).toEqual(12.47);
        expect(data[0].timestamp).toBeUndefined();

        // Value is infinite and timestamp is negative
        metric = metrics['something_weird'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('unknown');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        data = metric.data as PromData[];

        expect(data[0].value).toEqual(+Infinity);
        expect(data[0].timestamp).toEqual(-3982045);

        // Histogram
        metric = metrics['http_request_duration_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('histogram');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        const histogramData = metric.data as PromHistogramData[];

        expect(histogramData[0].buckets).toEqual({
            '0.05': 24054,
            '0.1': 33444,
            '0.2': 100392,
            '0.5': 129389,
            '1': 133988,
            '+Inf': 144320
        });
        expect(histogramData[0].sum).toEqual(53423);
        expect(histogramData[0].count).toEqual(144320);

        // Summary
        metric = metrics['rpc_duration_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('summary');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        const summaryData = metric.data as PromSummaryData[];

        expect(summaryData[0].quantiles).toEqual({
            '0.01': 3102,
            '0.05': 3272,
            '0.5': 4773,
            '0.9': 9001,
            '0.99': 76656
        });
        expect(summaryData[0].sum).toEqual(1.7560473e7);
        expect(summaryData[0].count).toEqual(2693);
    });
});
