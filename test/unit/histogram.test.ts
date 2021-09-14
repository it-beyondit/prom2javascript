import { Readable } from 'stream';
import { getMetricsFromStream, PromHistogramData } from '../../src/prom'

it('parses a simple histogram', () => {
    const input = Readable.from([`
# HELP http_request_duration_seconds request duration histogram
# TYPE http_request_duration_seconds histogram
http_request_duration_seconds_bucket{le="0.5"} 0
http_request_duration_seconds_bucket{le="1"} 1
http_request_duration_seconds_bucket{le="2"} 2
http_request_duration_seconds_bucket{le="3"} 3
http_request_duration_seconds_bucket{le="5"} 3
http_request_duration_seconds_bucket{le="+Inf"} 3
http_request_duration_seconds_sum 6
http_request_duration_seconds_count 3    
`]);

    return getMetricsFromStream(input).then(metrics => {
        expect(Object.keys(metrics).length).toEqual(1);

        const metric = metrics['http_request_duration_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('histogram');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        const datum = metric.data[0] as PromHistogramData;

        expect(datum.labels).toEqual({});
        expect(datum.buckets).toEqual({
            '0.5': 0,
            '1': 1,
            '2': 2,
            '3': 3,
            '5': 3,
            '+Inf': 3
        });
        expect(datum.count).toEqual(3);
        expect(datum.sum).toEqual(6);
    });
});
