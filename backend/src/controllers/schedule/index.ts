/**
 * Schedule Controllers Index
 * Exports all schedule-related controllers and creates a composed controller
 */

export * from "./base-schedule.controller";
export * from "./schedule-crud.controller";
export * from "./schedule-route.controller";
export * from "./schedule-weather.controller";
export * from "./schedule-statistics.controller";

import { BaseScheduleController } from "./base-schedule.controller";
import { ScheduleCrudController } from "./schedule-crud.controller";
import { ScheduleRouteController } from "./schedule-route.controller";
import { ScheduleWeatherController } from "./schedule-weather.controller";
import { ScheduleStatisticsController } from "./schedule-statistics.controller";

/**
 * Composed Schedule Controller
 * Combines all schedule-related functionality using service composition pattern
 */
export class ScheduleController {
  private baseController: BaseScheduleController;
  private crudController: ScheduleCrudController;
  private routeController: ScheduleRouteController;
  private weatherController: ScheduleWeatherController;
  private statisticsController: ScheduleStatisticsController;

  // Method declarations
  getSchedules!: typeof BaseScheduleController.prototype.getSchedules;
  getScheduleById!: typeof BaseScheduleController.prototype.getScheduleById;
  updateSchedule!: typeof ScheduleCrudController.prototype.updateSchedule;
  deleteSchedule!: typeof ScheduleCrudController.prototype.deleteSchedule;
  getRoutePlan!: typeof ScheduleRouteController.prototype.getRoutePlan;
  updateRoutePlan!: typeof ScheduleRouteController.prototype.updateRoutePlan;
  recalculateRoute!: typeof ScheduleRouteController.prototype.recalculateRoute;
  getWeatherData!: typeof ScheduleWeatherController.prototype.getWeatherData;
  updateWeatherData!: typeof ScheduleWeatherController.prototype.updateWeatherData;
  getWeatherWarnings!: typeof ScheduleWeatherController.prototype.getWeatherWarnings;
  getWeatherForecast!: typeof ScheduleWeatherController.prototype.getWeatherForecast;
  getStatistics!: typeof ScheduleStatisticsController.prototype.getStatistics;

  constructor() {
    this.baseController = new BaseScheduleController();
    this.crudController = new ScheduleCrudController();
    this.routeController = new ScheduleRouteController();
    this.weatherController = new ScheduleWeatherController();
    this.statisticsController = new ScheduleStatisticsController();

    // Bind methods after controllers are initialized
    this.getSchedules = this.baseController.getSchedules.bind(this.baseController);
    this.getScheduleById = this.baseController.getScheduleById.bind(this.baseController);
    this.updateSchedule = this.crudController.updateSchedule.bind(this.crudController);
    this.deleteSchedule = this.crudController.deleteSchedule.bind(this.crudController);
    this.getRoutePlan = this.routeController.getRoutePlan.bind(this.routeController);
    this.updateRoutePlan = this.routeController.updateRoutePlan.bind(this.routeController);
    this.recalculateRoute = this.routeController.recalculateRoute.bind(this.routeController);
    this.getWeatherData = this.weatherController.getWeatherData.bind(this.weatherController);
    this.updateWeatherData = this.weatherController.updateWeatherData.bind(this.weatherController);
    this.getWeatherWarnings = this.weatherController.getWeatherWarnings.bind(this.weatherController);
    this.getWeatherForecast = this.weatherController.getWeatherForecast.bind(this.weatherController);
    this.getStatistics = this.statisticsController.getStatistics.bind(this.statisticsController);
  }
}

// Export singleton instance
export const scheduleController = new ScheduleController();
