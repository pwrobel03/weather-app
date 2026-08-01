import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { AlertEntry } from "./alert-entry";
import { HourlyForecastStrip } from "./hourly-forecast-strip";

const ALERT = {
  id: 900,
  event: "Silny wiatr",
  severity: "3" as const,
  validFrom: "2026-07-27T12:00:00Z",
  validTo: "2026-07-27T22:00:00Z",
  terytCodes: ["1465"],
  affectedLocations: [{ id: 1, name: "Warszawa" }],
  content: "Prognozuje się wystąpienie silnego wiatru.",
  comment: "Brak.",
  office: "IMGW-PIB Warszawa",
  probabilityPercent: 80,
};

describe("AlertEntry", () => {
  const during = new Date("2026-07-27T14:00:00Z");
  const after = new Date("2026-07-28T09:00:00Z");

  it("states the level in words, never only as a colour", () => {
    render(<AlertEntry alert={ALERT} locale="pl" now={during} />);

    // design.md §3. The coloured bar is decoration on top of this, not the
    // message itself - which matters for anyone who cannot separate the three
    // IMGW hues, and for anyone reading a phone in sunlight.
    expect(screen.getByText("Ostrzeżenie 3. stopnia")).toBeInTheDocument();
  });

  it("marks an expired warning rather than hiding it", () => {
    render(<AlertEntry alert={ALERT} locale="pl" now={after} />);

    // The timeline's value is showing what has passed - the question people
    // ask after a storm rather than during one.
    expect(screen.getByText("Zakończone")).toBeInTheDocument();
    expect(screen.getByText("Silny wiatr")).toBeInTheDocument();
  });

  it("keeps IMGW's own text untranslated, and says so to an English reader", () => {
    render(<AlertEntry alert={ALERT} locale="en" now={during} detailed />);

    expect(screen.getByText(ALERT.content)).toBeInTheDocument();
    // Machine-translating a safety message is a risk nobody asked us to take,
    // so the English UI states why this paragraph is in Polish.
    expect(screen.getByText(/Warning text in the original Polish/)).toBeInTheDocument();
  });

  it("hides IMGW's placeholder comment", () => {
    render(<AlertEntry alert={ALERT} locale="pl" now={during} detailed />);

    // "Brak." is what the feed sends when there is no comment; printing it
    // reads as content.
    expect(screen.queryByText("Brak.")).not.toBeInTheDocument();
  });

  it("omits the details until asked for them", () => {
    render(<AlertEntry alert={ALERT} locale="pl" now={during} />);

    expect(screen.queryByText(ALERT.content)).not.toBeInTheDocument();
    expect(screen.queryByText(/Prawdopodobieństwo/)).not.toBeInTheDocument();
  });
});

describe("HourlyForecastStrip", () => {
  const entries = [10, 11, 12, 13, 14].map((hour) => ({
    time: `2026-07-27T${String(hour).padStart(2, "0")}:00:00`,
    temperatureCelsius: 20,
    weatherCode: 61,
    precipitationProbabilityPercent: 40,
  }));

  it("starts at the next hour at the forecast location, not on the viewer's clock", () => {
    // The times carry no UTC offset: 12:00 means noon where the forecast is
    // for. Parsing them as Dates would reinterpret them in the viewer's own
    // timezone, and be right only by coincidence.
    render(<HourlyForecastStrip entries={entries} now={new Date("2026-07-27T10:00:00Z")} />);

    // 10:00Z is 12:00 in Warszawa, so the strip opens at 12:00.
    expect(screen.getByText("12:00")).toBeInTheDocument();
    expect(screen.queryByText("11:00")).not.toBeInTheDocument();
  });

  it("renders nothing when every entry is in the past", () => {
    const { container } = render(
      <HourlyForecastStrip entries={entries} now={new Date("2026-07-28T10:00:00Z")} />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
