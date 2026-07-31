/**
 * AsyncStorage in a Map.
 *
 * The real package ships untranspiled Flow, so importing anything that touches
 * it pulls the whole transform problem into a Node test. Only the four methods
 * the persister and the preference providers actually call are here.
 */
const store = new Map<string, string>();

export function __reset(): void {
  store.clear();
}

const AsyncStorage = {
  getItem: (key: string) => Promise.resolve(store.get(key) ?? null),
  setItem: (key: string, value: string) => {
    store.set(key, value);
    return Promise.resolve();
  },
  removeItem: (key: string) => {
    store.delete(key);
    return Promise.resolve();
  },
  clear: () => {
    store.clear();
    return Promise.resolve();
  },
};

export default AsyncStorage;
