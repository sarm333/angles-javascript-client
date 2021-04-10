import axios, { AxiosInstance} from "axios";
import { TeamRequests } from './requests/TeamRequests';
import { EnvironmentRequests } from './requests/EnvironmentRequests';
import { BuildRequests } from './requests/BuildRequests';
import { ExecutionRequests } from './requests/ExecutionRequests';
import { ScreenshotRequests } from './requests/ScreenshotRequests';
import {
  CreateBuild,
  CreateExecution,
  ScreenshotPlatform,
  StoreScreenshot
} from './models/RequestTypes';
import { Action, Artifact, Build, Execution, Screenshot, Step, StepStates } from './models/Types';

export class AnglesReporterClass {

  private static _instance:AnglesReporterClass = new AnglesReporterClass();
  protected axiosInstance: AxiosInstance;
  public teams:TeamRequests;
  public environments:EnvironmentRequests;
  public builds:BuildRequests;
  public executions:ExecutionRequests;
  public screenshots:ScreenshotRequests;

  private currentBuild: Build;
  private currentExecution: CreateExecution;
  private currentAction: Action;

  constructor() {
    if (AnglesReporterClass._instance) {
      throw new Error('Error: Instantiation failed: Use AnglesReporterClass.getInstance() instead of new.');
    }
    AnglesReporterClass._instance = this;
    const apiConfig = {
      returnRejectedPromiseOnError: true,
      timeout: 10000,
      baseURL: "http://127.0.0.1:3000/rest/api/v1.0/",
      headers: {
        common: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      },
    }
    this.axiosInstance = axios.create(apiConfig);
    this.teams = new TeamRequests(this.axiosInstance);
    this.environments = new EnvironmentRequests(this.axiosInstance);
    this.builds = new BuildRequests(this.axiosInstance);
    this.executions = new ExecutionRequests(this.axiosInstance);
    this.screenshots = new ScreenshotRequests(this.axiosInstance);
  }

  public static getInstance():AnglesReporterClass {
    return AnglesReporterClass._instance;
  }

  public async startBuild(name:string, team:string, environment:string, component: string): Promise<Build> {
    const createBuildRequest = new CreateBuild(
      name,
      environment,
      team,
      component
    );
    this.currentBuild = await this.builds.createBuild(createBuildRequest);
    return this.currentBuild;
  }

  public async addArtifacts(artifacts: Artifact[]): Promise<Build> {
    return await this.builds.addArtifacts(this.currentBuild._id, artifacts);
  }

  public startTest(title:string, suite: string):void {
    this.currentExecution = new CreateExecution();
    this.currentExecution.title = title;
    this.currentExecution.suite = suite;
    this.currentExecution.build = this.currentBuild._id;
    this.currentExecution.actions = [];
  }

  public async saveTest() {
    this.currentAction = undefined;
    return await this.executions.saveExecution(this.currentExecution)
  }

  public async saveScreenshot(filePath:string, view:string): Promise<Screenshot>  {
    return await this.saveScreenshotWithPlatform(filePath, view, undefined);
  }

  public async saveScreenshotWithPlatform(filePath:string, view:string, platform:ScreenshotPlatform): Promise<Screenshot> {
    const storeScreenshot = new StoreScreenshot();
    storeScreenshot.buildId = this.currentBuild._id;
    storeScreenshot.filePath = filePath;
    storeScreenshot.view = view;
    storeScreenshot.timestamp = new Date();
    try {
      return await this.screenshots.saveScreenshotWithPlatform(storeScreenshot, platform);
    } catch (error) {
      this.error(error);
    }
  }

  public addAction(name:string) {
    this.currentAction = new Action();
    this.currentAction.name = name;
    this.currentAction.start = new Date();
    this.currentAction.steps = [];
    this.currentExecution.actions.push(this.currentAction);
  }

  public info(info:string) {
    this.addStep("INFO",undefined,undefined,info, StepStates.INFO, undefined);
  }

  public infoWithScreenshot(info:string, screenshotId: string) {
    this.addStep("INFO",undefined,undefined,info, StepStates.INFO, screenshotId);
  }

  public error(error:string) {
    this.addStep("ERROR",undefined,undefined,error, StepStates.ERROR, undefined);
  }

  public errorWithScreenshot(error: string, screenshotId: string) {
    this.addStep("ERROR",undefined,undefined,error, StepStates.ERROR, screenshotId);
  }

  public pass(name:string, expected:string, actual:string, info:string): void {
    this.addStep(name,expected,actual,info,StepStates.PASS, undefined);
  }

  public passWithScreenshot(name:string, expected:string, actual:string, info:string, screenshot: string): void {
    this.addStep(name,expected,actual,info,StepStates.PASS, screenshot);
  }

  public fail(name:string, expected:string, actual:string, info:string) {
    this.addStep(name,expected,actual,info,StepStates.FAIL, undefined);
  }

  public failWithScreenshot(name:string, expected:string, actual:string, info:string, screenshotId: string) {
    this.addStep(name,expected,actual,info,StepStates.FAIL, screenshotId);
  }

  public addStep(name: string, expected: string, actual:string, info: string, status: StepStates, screenshot:string):void {
    if (this.currentAction === undefined) {
      this.addAction('test-details');
    }
    const step = new Step();
    step.name = name;
    step.actual = actual;
    step.expected = expected;
    step.info = info;
    step.status = status;
    step.timestamp = new Date();
    step.screenshot = screenshot;
    this.currentAction.steps.push(step);
  }

}
