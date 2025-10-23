import { useContext } from "react";
import { useSocketContext } from "../context/SocketProvider";

export const useSocket = () => {
  const { socket, connected } = useSocketContext();
  return { socket, connected };
};
