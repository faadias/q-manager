# q-manager
Implementação simples de um servidor acoplado ao RabbitMQ para gerenciamento de filas

## Rodando o projeto
1. Clone o projeto;
2. Crie um arquivo `.env` no diretório raiz do projeto (utilize como modelo o arquivo `.env.example`);
3. Instale as dependência utilizando o comando `npm install`;
4. Inicialize a instância local do RabbitMQ via docker através do comando `npm run docker:up`;
5. Aguarde alguns segundos após a instância do RabbitMQ subir (para evitar que ela não esteja totalmente pronta a receber conexões) e inicialize o servidor em modo de desenvolvimento com o comando `npm run start:dev`
Pronto! O servidor já está rodando.

*Observações:*
- Para desligar o servidor, aperte Ctrl+C no terminal onde ele foi inicializado.
- Para finalizar a instância do RabbitMQ, utilize o comando `npm run docker:down`.
- As configurações da instância do RabbitMQ (como usuário e senha) encontram-se definidas no arquivo `docker-compose.yml`
- O servidor sabe se conectar aao RabbitMQ utilizando as definições de variáveis de ambiente prefixadas por **QUEUE_** constantes do arquivo `.env`. Ou seja, para se conectar a uma instância remota ao invés da versão local via docker, basta alterar as variáveis de ambiente.
- Como não foi especificado volume físico para a instância do RabbitMQ no `docker-compose.yml`, as filas deixam de existir sempre que a instância do RabbitMQ é desligada.

## Criando Produtores e Consumidores
Para um rápido exemplo, inicie o servidor em modo de teste (`npm run start:test`) e utilize a rota `/test` para fazer um POST no qual os dados da mensagem se encontrem no body da requisição. Assim que a mensagem for colocada na fila do RabbitMQ, aparecerá uma mensagem no console dizendo que a mensagem foi consumida, contendo seu ID (gerado pelo servidor) e um hash MD5 dos dados enviados no corpo da requisição.

1. Crie um Consumer de dados na pasts `consumer`. Obs.: são os Consumers que definem as filas a serem criada no RabbitMQ, logo, é preciso haver um Consumer para sua fila ser criada e um Producer poder colocar dados nela. Exemplo de Consumer:
```typescript
export class DummyConsumer implements IConsumer {
  readonly queue = "nome-da-fila";
  readonly name = "nome-do-consumer";
  consume(message: Message): void {
    console.info(`Message ID ${message.id} was consumed!`);
  }
}
```
2. Crie um novo Controller na pasta `src/controllers`. Obs.: o projeto utiliza a biblioteca [OvernightJS](https://www.npmjs.com/package/@overnightjs/core) para a criação de Controllers;
3. Quando quiser colocar algo em uma fila, utilize o objeto `publisher` que se encontra dentro da `Request` para publicar um conjunto de dados. Exexemplo de POST com os dados a serem colocados na fila contidos no body da requisição:
```typescript
@Controller("foo")
export class FooController {
  @Post()
  async post(req: Request, res: Response) {
    await req.publisher.publish('nome-da-fila', {id: 'dummy-id', data: req.body});
    res.status(201).send();
  }
}
```
4. Agora é só iniciar o servidor (`npm run start:dev`) e fazer um POST para `/foo` com os dados contidos no body da requisição. O Consumer será executado tão logo haja mensagens na fila.

*Observação:* Para Producers que só precisam receber dados e colocar numa fila, foi criada uma classe abstrata chamada `BaseRawDataProducerController` contendo um método utilitário `publish` que já faz essa trativa, verifica erros e retorna uma resposta.
