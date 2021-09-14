import { Readable } from 'stream';
import { getMetricsFromStream, PromSummaryData } from '../../src/prom'

it('parses a simple summary', () => {
    const input = Readable.from([`
# HELP go_gc_duration_seconds A summary of the GC invocation durations.
# TYPE go_gc_duration_seconds summary
go_gc_duration_seconds{quantile="0"} 3.291e-05
go_gc_duration_seconds{quantile="0.25"} 4.3849e-05
go_gc_duration_seconds{quantile="0.5"} 6.2452e-05
go_gc_duration_seconds{quantile="0.75"} 9.8154e-05
go_gc_duration_seconds{quantile="1"} 0.011689149
go_gc_duration_seconds_sum 3.451780079
go_gc_duration_seconds_count 13118
`]);

    return getMetricsFromStream(input).then(metrics => {
        expect(Object.keys(metrics).length).toEqual(1);

        const metric = metrics['go_gc_duration_seconds'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('summary');
        expect(metric.help).toEqual('A summary of the GC invocation durations.');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        const datum = metric.data[0] as PromSummaryData;

        expect(datum.labels).toEqual({});
        expect(datum.quantiles).toEqual({
            '0': 3.291e-05,
            '0.25': 4.3849e-05,
            '0.5': 6.2452e-05,
            '0.75': 9.8154e-05,
            '1': 0.011689149
        });
        expect(datum.count).toEqual(13118);
        expect(datum.sum).toEqual(3.451780079);
    });
});
