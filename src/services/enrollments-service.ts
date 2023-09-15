import { Address, Enrollment } from '@prisma/client';
import { request } from '@/utils/request';
import { notFoundError } from '@/errors';
import { addressRepository, CreateAddressParams, enrollmentRepository, CreateEnrollmentParams } from '@/repositories';
import { exclude } from '@/utils/prisma-utils';

// TODO - Receber o CEP por parâmetro nesta função.
async function getAddressFromCEP(cep: string) {
  // FIXME: está com CEP fixo!
  const result = await request.get(`${process.env.VIA_CEP_API}/${cep}/json/`);

  // TODO: Tratar regras de negócio e lanças eventuais erros
  if (!result.data) {
    throw notFoundError();
  }

  // FIXME: não estamos interessados em todos os campos
  const { logradouro, complemento, bairro, localidade, uf } = result.data;
  return { logradouro, complemento, bairro, cidade: localidade, uf };
}

async function getOneWithAddressByUserId(userId: number): Promise<GetOneWithAddressByUserIdResult> {
  const enrollmentWithAddress = await enrollmentRepository.findWithAddressByUserId(userId);

  if (!enrollmentWithAddress) throw notFoundError();

  const [firstAddress] = enrollmentWithAddress.Address;
  const address = getFirstAddress(firstAddress);

  return {
    ...exclude(enrollmentWithAddress, 'userId', 'createdAt', 'updatedAt', 'Address'),
    ...(!!address && { address }),
  };
}

type GetOneWithAddressByUserIdResult = Omit<Enrollment, 'userId' | 'createdAt' | 'updatedAt'>;

function getFirstAddress(firstAddress: Address): GetAddressResult {
  if (!firstAddress) return null;

  return exclude(firstAddress, 'createdAt', 'updatedAt', 'enrollmentId');
}

type GetAddressResult = Omit<Address, 'createdAt' | 'updatedAt' | 'enrollmentId'>;

async function createOrUpdateEnrollmentWithAddress(params: CreateOrUpdateEnrollmentWithAddress) {
  const enrollment = exclude(params, 'address');
  enrollment.birthday = new Date(enrollment.birthday);
  const address = getAddressForUpsert(params.address);

  // TODO - Verificar se o CEP é válido antes de associar ao enrollment.
  try {
    const response = await request.get(`${process.env.VIA_CEP_API}/${address.cep}/json/`);

    if (response.status === 400) {
      throw new Error('CEP inválido');
    }

    const cepData = response.data;

    if (!cepData) {
      throw new Error('CEP inválido');
    }

    // Se o CEP for válido, você pode prosseguir com a criação ou atualização da matrícula.
    const newEnrollment = await enrollmentRepository.upsert(params.userId, enrollment, exclude(enrollment, 'userId'));
    await addressRepository.upsert(newEnrollment.id, address, address);
  } catch (error) {
    console.error('Erro ao verificar o CEP:', error);
  }
}

function getAddressForUpsert(address: CreateAddressParams) {
  return {
    ...address,
    ...(address?.addressDetail && { addressDetail: address.addressDetail }),
  };
}

export type CreateOrUpdateEnrollmentWithAddress = CreateEnrollmentParams & {
  address: CreateAddressParams;
};

export const enrollmentsService = {
  getOneWithAddressByUserId,
  createOrUpdateEnrollmentWithAddress,
  getAddressFromCEP,
};
