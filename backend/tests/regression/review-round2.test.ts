/**
 * Review round 2 (CodeRabbit on 15537d9), defects verified in the code:
 * - WeatherMonitoringService.updateWeatherForSchedule read `schedule.user.id`,
 *   but ScheduleDataRepository.findWithRelations does not load `user`, so the
 *   "create new weather row" branch threw TypeError.
 * - NotificationService interpolated untrusted values (e.g. a location parsed
 *   from a PDF) into the HTML e-mail body without escaping.
 */
import { WeatherMonitoringService } from "@/services/weather-monitoring.service";
import { NotificationService } from "@/services/notification.service";

describe("WeatherMonitoringService.updateWeatherForSchedule", () => {
  it("stores new weather with the schedule's userId when no user relation is loaded", async () => {
    const weatherService: any = {
      getWeatherForecast: jest.fn().mockResolvedValue({
        temperature: 12,
        description: "clear",
        windSpeed: 3,
        precipitation: 0,
        humidity: 50,
        warnings: [],
        fetchedAt: new Date(),
        location: "Warsaw",
        date: "2030-01-01",
      }),
      storeWeatherData: jest.fn().mockResolvedValue({}),
      updateWeatherData: jest.fn(),
    };
    const svc = new WeatherMonitoringService(weatherService, {} as any, {} as any);

    // Shape returned by findWithRelations: no `user`, weatherData empty.
    const schedule: any = {
      id: "sched-1",
      userId: "user-1",
      location: "Warsaw",
      shootingDate: new Date("2030-01-01T08:00:00Z"),
      weatherData: [],
      email: null,
      routePlan: null,
      calendarEvent: null,
    };

    await svc.updateWeatherForSchedule(schedule);

    expect(weatherService.storeWeatherData).toHaveBeenCalledTimes(1);
    expect(weatherService.storeWeatherData.mock.calls[0][1]).toBe("user-1");
  });
});

describe("NotificationService.renderTemplate", () => {
  const template: any = {
    subject: "Schedule at {{scheduleData.location}}",
    emailTemplate: "<p>Location: {{scheduleData.location}}</p>",
    smsTemplate: "Location: {{scheduleData.location}}",
    pushTemplate: { title: "{{scheduleData.location}}", body: "{{scheduleData.location}}" },
  };
  const data: any = { scheduleData: { location: '<img src=x onerror="alert(1)"> & "Studio"' } };

  function svc(): any {
    return new NotificationService({} as any, {} as any) as any;
  }

  it("HTML-escapes interpolated values in the e-mail body", () => {
    const { message } = svc().renderTemplate(template, "email", data);
    expect(message).not.toContain("<img");
    expect(message).toBe(
      "<p>Location: &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &quot;Studio&quot;</p>"
    );
  });

  it("keeps the template's own markup and leaves subject/SMS/push text unescaped", () => {
    const s = svc();
    expect(s.renderTemplate(template, "email", data).subject).toBe(
      'Schedule at <img src=x onerror="alert(1)"> & "Studio"'
    );
    expect(s.renderTemplate(template, "sms", data).message).toBe(
      'Location: <img src=x onerror="alert(1)"> & "Studio"'
    );
    expect(s.renderTemplate(template, "push", data).message).toBe(
      '<img src=x onerror="alert(1)"> & "Studio"'
    );
  });
});
