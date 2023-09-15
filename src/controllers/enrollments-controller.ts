import { Response } from 'express';
import httpStatus from 'http-status';
import { AuthenticatedRequest } from '@/middlewares';
import { enrollmentsService } from '@/services';

export async function getEnrollmentByUser(req: AuthenticatedRequest, res: Response) {
  const { userId } = req;

  const enrollmentWithAddress = await enrollmentsService.getOneWithAddressByUserId(userId);

  return res.status(httpStatus.OK).send(enrollmentWithAddress);
}

export async function postCreateOrUpdateEnrollment(req: AuthenticatedRequest, res: Response) {
  await enrollmentsService.createOrUpdateEnrollmentWithAddress({
    ...req.body,
    userId: req.userId,
  });

  return res.sendStatus(httpStatus.OK);
}

// TODO - Receber o CEP do usuário por query params.
export async function getAddressFromCEP(req: AuthenticatedRequest, res: Response) {
  const { cep } = req.query;

  try {
    const address = await enrollmentsService.getAddressFromCEP(String(cep));
    res.status(httpStatus.OK).send(address);
  } catch (error) {
    if (error.message === 'CEP inválido') {
      res.status(httpStatus.BAD_REQUEST).send({ error: 'CEP inválido' });
    } else {
      console.error('Erro ao obter o endereço:', error);
      res.status(httpStatus.INTERNAL_SERVER_ERROR).send({ error: 'Erro interno do servidor' });
    }
  }
}



