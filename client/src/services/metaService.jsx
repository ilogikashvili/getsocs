import axios from '../api/axios';

export async function getMeta() {
  return axios.get('/meta/platforms');
}

const metaService = { getMeta };
export default metaService;
