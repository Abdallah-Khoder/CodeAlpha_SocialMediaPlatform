import { createContext, useContext, useState } from "react";

const StoriesContext = createContext(null);

export function StoriesProvider({ children }) {
  // Bumping this number tells StoriesBar "something changed, refetch"
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  const notifyStoriesChanged = () => {
    setRefreshTrigger((prev) => prev + 1);
  };

  return (
    <StoriesContext.Provider value={{ refreshTrigger, notifyStoriesChanged }}>
      {children}
    </StoriesContext.Provider>
  );
}

export function useStories() {
  return useContext(StoriesContext);
}