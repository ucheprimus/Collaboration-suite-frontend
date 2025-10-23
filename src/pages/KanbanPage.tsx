// src/pages/KanbanPage.tsx
import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import type { Task } from "../types";

import "../styles/TaskCard.css";

import {
  DragDropContext,
  Droppable,
  Draggable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Button, Card, Form, Modal, Badge } from "react-bootstrap";

const columns = {
  todo: "To Do",
  in_progress: "In Progress",
  on_hold: "On Hold",
  done: "Completed",
};

interface Profile {
  id: string;
  full_name: string;
}
interface Task {
  id?: string;
  title: string;
  description?: string;
  status: "todo" | "in-progress" | "done";
  assignee?: string;
  due_date?: string;
  priority: "low" | "medium" | "high";
}

export default function KanbanPage() {
  const [tasks, setTasks] = useState<any[]>([]);
  const [users, setUsers] = useState<Profile[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as Task["status"],
    assignee: "",
    due_date: "",
    priority: "medium" as Task["priority"],
  });

  // Fetch tasks with profile info
  useEffect(() => {
    const fetchTasks = async () => {
      const { data, error } = await supabase
        .from("tasks")
        .select(
          `
    *,
    creator:profiles!tasks_creator_id_fkey(full_name, avatar_url),
    assignee_profile:profiles!tasks_assignee_fkey(full_name, avatar_url)
  `
        )
        .order("order_index", { ascending: true });

      if (error) console.error(error);
      else setTasks(data || []);
    };
    fetchTasks();
  }, []);

  // Fetch users for dropdown
  useEffect(() => {
    const fetchUsers = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name");
      if (error) console.error(error);
      else setUsers(data || []);
    };
    fetchUsers();
  }, []);

  // Drag and drop handler
const handleDragEnd = async (result: DropResult) => {
  const { source, destination } = result;
  if (!destination) return;
  if (source.droppableId === destination.droppableId && source.index === destination.index) return;

  const updatedTasks = Array.from(tasks);
  
  // Find the task being moved
  const movedTask = updatedTasks.find((t) => t.id === result.draggableId);
  if (!movedTask) return;

  // Update status and order_index based on destination
  movedTask.status = destination.droppableId as Task["status"];
  movedTask.order_index = destination.index;

  // Remove it from the original position
  const sourceIndex = updatedTasks.findIndex((t) => t.id === movedTask.id);
  updatedTasks.splice(sourceIndex, 1);

  // Insert into the array in the correct position among its new column tasks
  const columnTasks = updatedTasks.filter((t) => t.status === movedTask.status);
  const before = updatedTasks.filter((t) => t.status !== movedTask.status);
  const newColumnTasks = [...columnTasks];
  newColumnTasks.splice(destination.index, 0, movedTask);

  setTasks([...before, ...newColumnTasks]);

  // Persist only the moved task
  const { error } = await supabase
    .from("tasks")
    .update({ status: movedTask.status, order_index: movedTask.order_index })
    .eq("id", movedTask.id);

  if (error) console.error("Failed to move task:", movedTask.id, error);
};


  // Create new task
  const handleCreateTask = async () => {
    if (!newTask.title.trim()) return;

    // get logged-in user
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { data, error } = await supabase
      .from("tasks")
      .insert([
        {
          ...newTask,
          assignee: newTask.assignee || null,
          creator_id: user?.id || null,
          order_index: tasks.filter((t) => t.status === newTask.status).length,
        },
      ])
      .select(
        "*, profiles!tasks_creator_id_fkey(full_name), assignee_profile:profiles!tasks_assignee_fkey(full_name)"
      )
      .single();

    if (error) {
      console.error("❌ Error inserting task:", error);
    } else {
      setTasks((prev) => [...prev, data]);
    }

    setShowModal(false);
    setNewTask({
      title: "",
      description: "",
      status: "todo",
      assignee: "",
      due_date: "",
      priority: "medium",
    });
  };

  return (
    <div className="container py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2 className="fw-bold">Task Board</h2>
        <Button variant="primary" onClick={() => setShowModal(true)}>
          + Add Task
        </Button>
      </div>

      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="row">
          {Object.entries(columns).map(([status, title]) => (
            <div className="col-md-3" key={status}>
              <Droppable droppableId={status}>
                {(provided) => (
                  <div
                    className="bg-light p-3 rounded border"
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                  >
                    <h5 className="mb-3">{title}</h5>

                    {tasks
                      .filter((t) => t.status === status)
                      .map((task, index) => (
                        <Draggable
                          key={task.id}
                          draggableId={task.id.toString()}
                          index={index}
                        >
                          {(provided) => (
                            <Card
                              className={`mb-3 shadow-sm task-card ${
                                task.status === "in_progress"
                                  ? "border border-primary"
                                  : task.status === "on_hold"
                                  ? "border border-danger"
                                  : task.status === "done"
                                  ? "border border-success"
                                  : ""
                              }`}
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                            >
                              <Card.Body>
                                {/* Title & Priority */}
                                <div className="d-flex justify-content-between align-items-center mb-2">
                                  <Card.Title className="h6 mb-0">
                                    {task.title}
                                  </Card.Title>
                                  {task.priority && (
                                    <span
                                      className={`badge priority-${task.priority}`}
                                    >
                                      {task.priority}
                                    </span>
                                  )}
                                </div>

                                {/* Description */}
                                {task.description && (
                                  <Card.Text className="task-desc">
                                    {task.description}
                                  </Card.Text>
                                )}

                                {/* Metadata */}
                                <div className="task-meta d-flex justify-content-between align-items-center mt-2 small text-muted">
                                  <div className="d-flex align-items-center gap-2">
                                    <span title="Assignee">
                                      🅰{" "}
                                      {task.assignee_profile?.full_name ||
                                        "Unassigned"}
                                    </span>
                                    <span title="Creator">
                                      🅲 {task.profiles?.full_name || "Unknown"}
                                    </span>
                                  </div>
                                  <span title="Due Date">
                                    📅 {task.due_date || "No due date"}
                                  </span>
                                </div>
                              </Card.Body>
                            </Card>
                          )}
                        </Draggable>
                      ))}

                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          ))}
        </div>
      </DragDropContext>

      {/* Create Task Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)} centered>
        <Modal.Header closeButton>
          <Modal.Title>Create Task</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form>
            <Form.Group className="mb-3">
              <Form.Label>Title</Form.Label>
              <Form.Control
                type="text"
                value={newTask.title}
                onChange={(e) =>
                  setNewTask((prev) => ({ ...prev, title: e.target.value }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Description</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                value={newTask.description}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Assignee</Form.Label>
              <Form.Select
                value={newTask.assignee}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    assignee: e.target.value,
                  }))
                }
              >
                <option value="">-- Select Assignee --</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.full_name}
                  </option>
                ))}
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Due Date</Form.Label>
              <Form.Control
                type="date"
                value={newTask.due_date}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    due_date: e.target.value,
                  }))
                }
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Priority</Form.Label>
              <Form.Select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    priority: e.target.value as Task["priority"],
                  }))
                }
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Form.Select>
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Status</Form.Label>
              <Form.Select
                value={newTask.status}
                onChange={(e) =>
                  setNewTask((prev) => ({
                    ...prev,
                    status: e.target.value as Task["status"],
                  }))
                }
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="on_hold">On Hold</option>
                <option value="done">Completed</option>
              </Form.Select>
            </Form.Group>
          </Form>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowModal(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={handleCreateTask}>
            Create Task
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
}
