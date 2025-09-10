import { useEffect, useState } from "react";
import API from "../api/API";

// Generic hook: accepts a type T for the data you're loading
const useLoad = <T = any>(
  loadEndpoint: string
): [
  T[],
  React.Dispatch<React.SetStateAction<T[]>>,
  boolean,
  (endPoint: string) => Promise<void>
] => {
  const [records, setRecords] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadRecords = async (endPoint: string): Promise<void> => {
    const response = await API.get<T[]>(endPoint);
    if (response.isSuccess) {
      setRecords(response.result ?? []);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    loadRecords(loadEndpoint);
  }, [loadEndpoint]);

  return [records, setRecords, isLoading, loadRecords];
};

export default useLoad;
