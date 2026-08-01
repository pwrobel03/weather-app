import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { ForecastTrend } from "./forecast-trend";

/**
 * The chart's readout, reached without a pointer.
 *
 * The crosshair is the only way to read an individual hour off this chart, so
 * a pointer-only chart makes that reading unavailable to anyone using a
 * keyboard - which is what these cover. The geometry itself is tested in
 * packages/core, where it has no renderer attached.
 */
const HOURS = Array.from({ length: 12 }, (_, index) => ({
  time: `2026-08-01T${String(index + 8).padStart(2, "0")}:00`,
  temperatureCelsius: 20 + index,
  precipitationProbabilityPercent: index * 5,
  weatherCode: 1,
}));

const NOW = new Date("2026-08-01T07:00:00");

describe("ForecastTrend", () => {
  it("gives each plot a name rather than leaving it an unlabelled graphic", async () => {
    render(<ForecastTrend entries={HOURS} now={NOW} />);

    expect(
      await screen.findByRole("slider", { name: /Temperatura/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("slider", { name: /Szansa opadu/ })).toBeInTheDocument();
  });

  it("reads an hour out when stepped into with the keyboard", async () => {
    const user = userEvent.setup();
    render(<ForecastTrend entries={HOURS} now={NOW} />);

    const plot = screen.getByRole("slider", { name: /Temperatura/ });
    plot.focus();
    await user.keyboard("{ArrowRight}");

    // The hour and the reading, not the index - an index is a fact about the
    // array, not about the weather.
    expect(plot).toHaveAttribute("aria-valuetext", expect.stringContaining("21°C"));
  });

  it("stops at the last hour instead of walking off the end", async () => {
    const user = userEvent.setup();
    render(<ForecastTrend entries={HOURS} now={NOW} />);

    const plot = screen.getByRole("slider", { name: /Temperatura/ });
    plot.focus();
    await user.keyboard("{ArrowRight>20/}");

    expect(plot).toHaveAttribute("aria-valuenow", String(HOURS.length - 1));
  });

  it("leaves the readout on Escape, the way a pointer leaves by moving away", async () => {
    const user = userEvent.setup();
    render(<ForecastTrend entries={HOURS} now={NOW} />);

    const plot = screen.getByRole("slider", { name: /Temperatura/ });
    plot.focus();
    await user.keyboard("{ArrowRight}{Escape}");

    expect(plot).not.toHaveAttribute("aria-valuetext");
  });

  it("renders nothing when there is not enough forecast to draw a shape", () => {
    // One reading is a number, not a trend, and a chart of it would be a line
    // with no direction.
    const { container } = render(<ForecastTrend entries={HOURS.slice(0, 1)} now={NOW} />);

    expect(container).toBeEmptyDOMElement();
  });
});
