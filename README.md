# Lince Scheduler

The `Lince` (Linx) Scheduler is a JavaScript module that aims to create a robust and reliable message processor for handling messages from a queue. It provides functionality for parsing and processing messages with a built-in retry mechanism to handle errors gracefully.

## Installation

You can install `LinceScheduler` module by using npm:
```
npm install lince-scheduler
```

## Features

### Task Retry Executor

* Process messages from a queue: The Task Retry Executor is designed to handle messages retrieved from a queue, such as a message broker or a queue system.
* Retry mechanism: In case of errors during message processing, the executor automatically retries the task based on the configured retry options, allowing for resilient message processing.
* Customizable task handler: You can implement your own task handler class to define the logic for processing the messages according to your application's requirements.
* Flexible message parsing: The executor supports custom message parser implementations, allowing you to parse the incoming messages in a way that suits your data format or protocol.
* Extensible logging: The module provides a default console logger implementation, but you can easily integrate your own logger to capture logs and errors generated during message processing.
* Context sharing: The executor allows you to pass a context object to the task handler and message parser, enabling the sharing of functionality or data across different processing tasks.
* Simple integration: The Task Retry Executor and Scheduler can be easily integrated into your existing codebase, providing a reusable and modular solution for message processing with retry capabilities.

### Task Scheduler

* Schedule tasks with a cron expression: The Task Scheduler enables you to schedule the execution of tasks based on a cron expression, allowing you to automate recurring tasks with precision.
* Integration with Task Retry Executor: The Task Scheduler works seamlessly with the Task Retry Executor, providing a convenient way to schedule and execute tasks with retry functionality.
* Customizable task handling and logging: You can define your own task handler and logger implementations to tailor the behavior of the scheduler to your specific requirements.
* Error handling and reporting: The Task Scheduler captures errors encountered during task execution and provides error reporting capabilities for monitoring and troubleshooting.
* Real-time stats processing: The scheduler includes a statistics handler that allows you to process and handle statistics in real time as tasks are executed.
* Simple integration: The Task Scheduler can be easily integrated into your codebase, enabling you to automate task execution and streamline your workflow.

## Usage

Here's an example of how you can use the Task Retry Executor and Task Scheduler modules in your code:

```javascript
const { TaskRetryExecutor, TaskScheduler, Task, DefaultConsoleLogger } = require('task-retry-executor');

// Create an instance of TaskRetryExecutor
const executor = new TaskRetryExecutor({
  intervalMs: 2000, // Interval between retries in milliseconds
  maxRetries: 3,   // Maximum number of retries
  handler: new MyTaskHandler(), // Custom task handler implementation
  parser: new MyMessageParser(), // Custom message parser implementation
  logger: new DefaultConsoleLogger(), // Logger implementation
});

// Create an instance of TaskScheduler
const scheduler = new TaskScheduler({
  cronExpression: '*/10 * * * *', // Cron expression for scheduling tasks (e.g., every 10 seconds)
  executor: executor, // TaskRetryExecutor instance for executing scheduled tasks
  logger: new DefaultConsoleLogger(), // Logger implementation
});

// Schedule a task
scheduler.schedule({
  originalMessage: 'Scheduled task', // Original message to be processed
});

// Start the scheduler
scheduler.start();

// Stop the scheduler after a certain number of loops
scheduler.maxLoops = 10;

// Wait for the scheduler to complete
scheduler.getPromise()
  .then(() => {
    console.log('Scheduler completed.');
  })
  .catch((error) => {
    console.error('Scheduler encountered an error:', error);
  });
```

## Classes

### TaskRetryExecutor

The TaskRetryExecutor class is responsible for executing tasks with retry functionality. It provides options for configuring the retry behavior, task handler, message parser, and logging.

### TaskScheduler

The TaskScheduler class enables you to schedule the execution of tasks based on a cron expression. It works in conjunction with the TaskRetryExecutor to automate task execution and provide scheduling capabilities.

### Customization

Both the Task Retry Executor and Task Scheduler modules are designed to be customizable and extensible. You can implement your own task handler, message parser, or logger classes and pass them to the executor or scheduler to tailor their behavior to your specific needs.

### Task

The Task class represents a task to be executed by the TaskRetryExecutor. It tracks the task's state, retries, and completion status.

### Custom Task Handler

You can create your own custom task handler by implementing the logic for processing the messages. The task handler is responsible for handling individual tasks and returning the processing result.

### Task

The Task class represents a task to be executed by the TaskRetryExecutor. It tracks the task's state, retries, and completion status.

### Custom Message Parser

The module allows you to implement a custom message parser to parse the incoming messages according to your specific data format or protocol. The message parser extracts the relevant data from the message for further processing.

### Logging

The Task Retry Executor and Task Scheduler provide logging capabilities through the logger implementation. By default, they include a DefaultConsoleLogger that logs messages and errors to the console. You can customize the logger to integrate with your existing logging infrastructure.

### Error Handling

The modules provide error handling capabilities by marking tasks as completed with errors and capturing error details. They support the retry mechanism to automatically retry failed tasks based on the configured retry options. Error reporting and logging can be customized to suit your requirements. And it handles different types of errors during message processing:

#### Fatal Errors

A fatal error represents a critical failure that cannot be recovered from. When a fatal error occurs, the Task Retry Executor marks the task as completed with an error and does not retry the task. It stops further execution of the task and reports the error. You can define custom handling for fatal errors in your task handler implementation.

#### Transient Errors

A transient error is a temporary or recoverable failure that may occur during message processing. Examples of transient errors include network errors or resource unavailability. When a transient error occurs, the Task Retry Executor automatically retries the task based on the configured retry options. The number of retries is limited, and if the maximum number of retries is reached without success, the task is marked as completed with an error. You can customize the retry behavior and maximum number of retries according to your requirements.

The Task Scheduler also handles fatal and transient errors encountered during task execution. It captures the errors and provides error reporting capabilities for monitoring and troubleshooting.

### Context Sharing

The Task Retry Executor and Task Scheduler allow you to pass a context object to the task handler and message parser. This context object can be used to share functionality, resources, or data across different processing tasks, enhancing the flexibility and extensibility of the modules.

## License

This module is released under the [MIT License](https://opensource.org/license/mit/).
