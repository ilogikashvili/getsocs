import axios from '../api/axios';
import type { MetaResponse } from '../types/api';
export async function getMeta() { return axios.get<MetaResponse>('/meta/platforms'); }
const metaService = { getMeta };
export default metaService;
