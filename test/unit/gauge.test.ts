import { Readable } from 'stream';
import { getMetricsFromStream, PromData } from '../../src/prom'

it('parses a simple gauge', () => {
    const input = Readable.from([`
# HELP go_goroutines Number of goroutines that currently exist.
# TYPE go_goroutines gauge
go_goroutines 73    
    `]);

    return getMetricsFromStream(input).then(metrics => {
        expect(Object.keys(metrics).length).toEqual(1);

        const metric = metrics['go_goroutines'];

        expect(metric).not.toBeNull();
        expect(metric.type).toEqual('gauge');
        expect(metric.help).toEqual('Number of goroutines that currently exist.');
        expect(metric.data).not.toBeNull();
        expect(metric.data.length).toEqual(1);

        const datum = metric.data[0] as PromData;

        expect(datum.value).toEqual(73);
    });
});
